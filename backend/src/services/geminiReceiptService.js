// Bill / receipt / payment-screenshot scanner — Gemini 2.5 Flash-Lite vision
// call. Replaces the Anthropic implementation in receiptScanService.js
// behind the same POST /api/records/scan contract (SCAN_ENDPOINT_CONTRACT.md)
// so the route and the mobile app need no changes: same input shape, same
// ScanResult JSON shape, same tagged error codes.
//
// Reuses receiptScanService.js's response normalisation (extractJson,
// normalizeResult, categoryOutline, buildContextText) — those are pure,
// provider-agnostic functions with no Anthropic dependency, already
// unit-tested in receiptScanService.test.js. Both providers therefore
// parse/validate a model's JSON identically, and the provider can be
// swapped back by changing one `require` in consumer.routes.js.
//
// Cost strategy: Gemini 2.5 Flash-Lite is priced at roughly 1/20th–1/25th
// the per-token cost of the Claude vision call this replaces. On top of
// that, images are sent PROGRESSIVELY — the common case (one receipt photo
// or one payment-app screenshot) is answered from a single image in a
// single Gemini call; only when merchant+amount are still missing after
// that does the next image join the request, up to all uploaded images.
// A 4-image bill costs a few extra (very cheap) calls instead of always
// paying for every image up front.
//
// Privacy: identical to receiptScanService.js — images are processed in
// memory only, never persisted, and neither the extracted values nor the
// raw model output are ever logged. sharp drops EXIF on re-encode; HEIC is
// transcoded in-process.
const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const { GEMINI_API_KEY } = require('../config/env');
const { extractJson, normalizeResult, buildContextText } = require('./receiptScanService');

// Cheapest current Gemini vision model with structured-output support —
// see the cost comment above. `gemini-2.5-flash-lite` (the original target)
// returns 404 "no longer available to new users" on keys issued after its
// cutoff — Google's own error redirects new callers to this one. Swap here
// (and nowhere else) to change model.
const SCAN_MODEL = 'gemini-3.5-flash-lite';
const MAX_EDGE = 1600;
const UPSTREAM_TIMEOUT_MS = 40_000;
const MAX_OUTPUT_TOKENS = 4000;

const SOURCE_KINDS = ['gpay', 'phonepe', 'paytm', 'bank', 'upi', 'receipt', 'invoice', 'other'];

function tagged(code, message, extra) {
  const err = new Error(message || code);
  err.code = code;
  if (extra && extra.warnings) err.warnings = extra.warnings;
  if (extra && extra.cause) err.cause = extra.cause;
  return err;
}

let _client = null;
function gemini() {
  if (!GEMINI_API_KEY) throw tagged('NO_API_KEY', 'GEMINI_API_KEY is not configured');
  if (!_client) {
    _client = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      // Best-effort — a manual race backs this up in callGemini() regardless
      // of whether this SDK option is honoured.
      httpOptions: { timeout: UPSTREAM_TIMEOUT_MS },
    });
  }
  return _client;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(tagged('UPSTREAM_ERROR', message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// image normalisation — same pipeline as receiptScanService.toImageBlock,
// emitting Gemini's inlineData part shape instead of Claude's image block.
// ---------------------------------------------------------------------------

async function toImagePart(file) {
  const name = file.originalname || '';
  const mime = (file.mimetype || '').toLowerCase();
  const looksHeic = /hei[cf]/.test(mime) || /\.hei[cf]$/i.test(name);
  try {
    let buf = file.buffer;
    if (looksHeic) {
      buf = Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 }));
    }
    const jpeg = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// prompt + structured-output schema
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return [
    'You extract ONE financial transaction from images of a bill, receipt, invoice, or a payment-app screenshot (GPay / PhonePe / Paytm / bank / UPI).',
    '',
    'You may be shown only some of the pages of a multi-page document — do your best with what is visible. If several images ARE shown, they are pages/screens of the SAME transaction, in order: reconcile totals across them, de-duplicate repeated information, and emit EXACTLY ONE transaction.',
    '',
    'AMOUNT RULE — the single most important field:',
    'The `amount` is the money that actually left the payer\'s hands.',
    '- Bill / invoice: the grand total AFTER tax and AFTER discount — the final payable line. Never the subtotal, never a single line item.',
    '- Payment app / bank / UPI: the transaction amount. NEVER the wallet or account balance, NEVER cashback / rewards / "you saved", NEVER a previous transaction\'s amount.',
    'If several plausible totals exist and you cannot tell which was paid, return the most likely one with confidence "low" and add a plain-language note to `warnings`.',
    '',
    'Worked examples:',
    '1. Receipt shows "Subtotal 780", "GST 90", "Discount -20", "Grand Total 850" -> amount = 850 (not 780).',
    '2. GPay screenshot shows a large "1,200" with "Paid to Ramesh", and lower down "Bank balance 45,300" -> amount = 1200 (not 45300).',
    '3. PhonePe shows "500" for the payment and "You saved 25 cashback" -> amount = 500.',
    '4. Two-page invoice: page 1 lists items, page 2 says "Amount Payable 3,450" -> ONE transaction, amount = 3450.',
    '5. A faded receipt shows both "1,180" and "1,810" and you cannot tell which is the total -> pick the more likely one, confidence "low", add a warning.',
    '',
    'Other fields:',
    '- `type` is "expense" unless the image clearly shows money RECEIVED (e.g. "received from", a salary credit, a refund credited) -> then "income".',
    '- `currency` as an ISO 4217 code (INR, USD, ...). `date` as YYYY-MM-DD. `time` as 24-hour HH:mm. `paymentMethod` as a short label ("UPI", "Credit Card", "Cash", "Bank Transfer", ...).',
    '- `categoryName` / `subcategoryName`: choose from the caller\'s category list ONLY (exact names). If nothing fits, use null. NEVER invent a category.',
    '- `referenceId`: the UPI / transaction / reference id. `invoiceNumber`: a bill or invoice number.',
    '- `subtotal` / `tax` / `discount`: numbers when the image breaks them out, else null. Group GST / VAT / service charge / cess together into `tax`.',
    '',
    'LINE ITEMS — do this thoroughly for a large or itemised bill:',
    'Return EVERY purchased line you can read in `lineItems`, in the order they appear, not just the first few. For each: `name` (the printed description), `qty` (units bought, or null if the line shows none), `amount` (the money for THAT line — the line total if printed, otherwise the unit price).',
    'If the bill is long and some rows are creased, cut off, or unreadable, return the rows you CAN read and add ONE `warnings` entry saying roughly how many were skipped. Do NOT invent items, names, quantities, or prices to fill gaps. The line items may be incomplete — but `amount` (the grand total) must still be the real amount paid, read from the bill\'s total line, never re-summed from partial items.',
    '',
    '`note` — a short readable spending summary (1 to 3 lines, <= 300 chars):',
    'Plain language describing WHAT was bought and the money breakdown, so the transaction is not just "Supermarket purchase". e.g. "Groceries: milk, bread, rice, vegetables, fruits, cleaning supplies, snacks. Subtotal 2000, discount 100, tax 342, paid 2242." Summarise a long list ("~20 grocery items") rather than repeating every row. If the bill is trivially small (one or two items) `note` may be null.',
    '',
    'Confidence & honesty: every field carries `confidence` of "high" or "low". If a value cannot be read, return `value: null`, `confidence: "low"`, and add a short `warnings` entry. DO NOT GUESS.',
    '',
    'Respond with JSON matching the given schema only.',
  ].join('\n');
}

function fieldSchema(type) {
  return {
    type: 'object',
    properties: {
      value: { type, nullable: true },
      confidence: { type: 'string', enum: ['high', 'low'] },
    },
    required: ['value', 'confidence'],
  };
}

const TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    merchant: fieldSchema('string'),
    amount: fieldSchema('number'),
    currency: fieldSchema('string'),
    date: fieldSchema('string'),
    time: fieldSchema('string'),
    type: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ['expense', 'income'], nullable: true },
        confidence: { type: 'string', enum: ['high', 'low'] },
      },
      required: ['value', 'confidence'],
    },
    paymentMethod: fieldSchema('string'),
    categoryName: fieldSchema('string'),
    subcategoryName: fieldSchema('string'),
    referenceId: fieldSchema('string'),
    invoiceNumber: fieldSchema('string'),
    subtotal: fieldSchema('number'),
    tax: fieldSchema('number'),
    discount: fieldSchema('number'),
    note: fieldSchema('string'),
  },
  required: [
    'merchant', 'amount', 'currency', 'date', 'time', 'type', 'paymentMethod',
    'categoryName', 'subcategoryName', 'referenceId', 'invoiceNumber',
    'subtotal', 'tax', 'discount', 'note',
  ],
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    transaction: TRANSACTION_SCHEMA,
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'number', nullable: true },
          amount: { type: 'number', nullable: true },
        },
        required: ['name'],
      },
    },
    sourceKind: { type: 'string', enum: SOURCE_KINDS },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['transaction', 'lineItems', 'sourceKind', 'warnings'],
};

// ---------------------------------------------------------------------------
// one Gemini call
// ---------------------------------------------------------------------------

async function callGemini(client, promptParts) {
  let response;
  try {
    response = await withTimeout(
      client.models.generateContent({
        model: SCAN_MODEL,
        contents: [{ role: 'user', parts: promptParts }],
        config: {
          systemInstruction: buildSystemPrompt(),
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0,
        },
      }),
      UPSTREAM_TIMEOUT_MS,
      'vision call timed out'
    );
  } catch (cause) {
    // Server-side breadcrumb only — never the images or the prompt/response.
    if (cause && cause.code === 'UPSTREAM_ERROR') throw cause;
    console.error('[geminiReceiptScan] upstream call failed', cause?.status || '', cause?.message || cause);
    throw tagged('UPSTREAM_ERROR', 'vision call failed', { cause });
  }

  // Cost visibility only — token counts, never the images/prompt/output.
  // This is exactly what lets a future "why did this cost X" question be
  // answered from logs instead of guessed at.
  const usage = response.usageMetadata;
  if (usage) {
    console.log('[geminiReceiptScan] usage', {
      promptTokenCount: usage.promptTokenCount,
      candidatesTokenCount: usage.candidatesTokenCount,
      totalTokenCount: usage.totalTokenCount,
    });
  }

  const candidate = response.candidates && response.candidates[0];
  if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
    throw tagged('MODEL_REFUSED', 'model declined the request');
  }

  const parsed = extractJson(response.text);
  if (!parsed) throw tagged('BAD_MODEL_OUTPUT', 'model did not return parseable JSON');
  return parsed;
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

// files: multer memory-storage parts ({ buffer, mimetype, originalname }).
// Same thrown error codes as receiptScanService.scanReceipts — the route
// maps them to HTTP status without caring which provider is behind this call:
//   NO_READABLE_IMAGES / NO_TRANSACTION      -> 422 no_transaction_found
//   NO_API_KEY / UPSTREAM_ERROR / BAD_MODEL_OUTPUT / MODEL_REFUSED -> 502 scan_failed
async function scanReceipts({ files, hints, categories }) {
  const client = gemini(); // fail fast on a missing key, before any work

  const parts = [];
  let unreadable = 0;
  for (const file of files || []) {
    const part = await toImagePart(file);
    if (part) parts.push(part);
    else unreadable += 1;
  }
  if (parts.length === 0) {
    throw tagged('NO_READABLE_IMAGES', 'no readable images', {
      warnings: ['None of the uploaded images could be read. If they are HEIC photos, try a screenshot or a JPEG/PNG.'],
    });
  }

  // Progressive image budget: try image 1 alone first (the common case — one
  // receipt or one payment screenshot needs nothing more), and only widen to
  // 2, 3, ... images if merchant+amount are still missing. Bounds the normal
  // scan to a single, cheap Gemini call.
  let result = null;
  for (let n = 1; n <= parts.length; n += 1) {
    const promptParts = [
      { text: buildContextText(hints, categories, n) },
      ...parts.slice(0, n).flatMap((part, i) => [{ text: `Image ${i + 1} of ${n}:` }, part]),
      { text: 'Return only the JSON object now.' },
    ];
    const parsed = await callGemini(client, promptParts);
    result = normalizeResult(parsed, { imageCount: (files || []).length });
    const sufficient = result.transaction.merchant.value != null && result.transaction.amount.value != null;
    if (sufficient) break;
  }

  if (unreadable > 0) {
    result.warnings.unshift(
      `${unreadable} image${unreadable === 1 ? '' : 's'} could not be read and ${unreadable === 1 ? 'was' : 'were'} skipped.`
    );
  }

  // Nothing usable came back even after trying every image — no merchant
  // AND no amount.
  if (result.transaction.merchant.value == null && result.transaction.amount.value == null) {
    throw tagged('NO_TRANSACTION', 'no transaction found', {
      warnings: result.warnings.length ? result.warnings : ['No transaction could be read from the image(s).'],
    });
  }

  return result;
}

module.exports = {
  SCAN_MODEL,
  scanReceipts,
};
