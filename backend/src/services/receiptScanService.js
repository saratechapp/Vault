// Bill / receipt / payment-screenshot scanner — the server-side vision call
// behind POST /api/records/scan. See SCAN_ENDPOINT_CONTRACT.md for the wire
// contract this implements.
//
// Why this lives on the backend and not in the app: deciding *which* number
// on a GPay/PhonePe screen or a multi-page bill is the amount actually paid
// (not a balance, cashback, "you saved", subtotal, or the first number seen)
// needs a vision-capable model, and the API key must never ship in the
// client bundle.
//
// Privacy (contract § Privacy): images are processed in memory only, never
// persisted, and neither the extracted values nor the raw model output are
// ever logged. sharp drops EXIF on re-encode; HEIC is transcoded in-process.
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const { ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID } = require('../config/env');

// Vision-capable and cheap enough for per-scan use (SCAN_ENDPOINT_CONTRACT.md).
const SCAN_MODEL = 'claude-sonnet-5';
// Longest edge we send upstream. The mobile client already ships quality:0.6
// JPEGs; this bounds token cost + memory for anything larger (or a HEIC).
const MAX_EDGE = 1600;
// Short upstream budget so a hung call fails fast instead of holding the
// request open; the mobile client's own timeout is 60s.
const UPSTREAM_TIMEOUT_MS = 40_000;

const TXN_FIELDS = {
  merchant: 'string', amount: 'number', currency: 'string', date: 'string',
  time: 'string', type: 'string', paymentMethod: 'string', categoryName: 'string',
  subcategoryName: 'string', referenceId: 'string', invoiceNumber: 'string',
  subtotal: 'number', tax: 'number', discount: 'number', note: 'string',
};
const SOURCE_KINDS = ['gpay', 'phonepe', 'paytm', 'bank', 'upi', 'receipt', 'invoice', 'other'];

function tagged(code, message, extra) {
  const err = new Error(message || code);
  err.code = code;
  if (extra && extra.warnings) err.warnings = extra.warnings;
  if (extra && extra.cause) err.cause = extra.cause;
  return err;
}

let _client = null;
function anthropic() {
  if (!ANTHROPIC_API_KEY) throw tagged('NO_API_KEY', 'ANTHROPIC_API_KEY is not configured');
  if (!_client) {
    _client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRetries: 0, // one shot — the client retries the whole scan on failure
      // Identity-linked keys require the workspace id on every request; a
      // normal key ignores an unset header.
      ...(ANTHROPIC_WORKSPACE_ID
        ? { defaultHeaders: { 'anthropic-workspace-id': ANTHROPIC_WORKSPACE_ID } }
        : {}),
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// image normalisation
// ---------------------------------------------------------------------------

// One uploaded part -> a base64 image block for the Messages API, or null if
// it can't be decoded (caller turns that into a warning). Always emits JPEG:
// the model doesn't accept HEIC, and a single media_type keeps things simple.
async function toImageBlock(file) {
  const name = file.originalname || '';
  const mime = (file.mimetype || '').toLowerCase();
  const looksHeic = /hei[cf]/.test(mime) || /\.hei[cf]$/i.test(name);
  try {
    let buf = file.buffer;
    if (looksHeic) {
      buf = Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 }));
    }
    const jpeg = await sharp(buf, { failOn: 'none' })
      .rotate() // bake in EXIF orientation before the re-encode strips EXIF
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return [
    'You extract ONE financial transaction from images of a bill, receipt, invoice, or a payment-app screenshot (GPay / PhonePe / Paytm / bank / UPI).',
    '',
    'The images are pages or screens of the SAME transaction, in order. Reconcile totals across them, de-duplicate repeated information, and emit EXACTLY ONE transaction.',
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
    '- `subtotal` / `tax` / `discount`: numbers when the image breaks them out, else null.',
    '',
    'Confidence & honesty: every field carries `confidence` of "high" or "low". If a value cannot be read, return `value: null`, `confidence: "low"`, and add a short `warnings` entry. DO NOT GUESS.',
    '',
    'OUTPUT: return ONLY a single JSON object, no prose, no markdown fences. Shape:',
    '{',
    '  "transaction": {',
    '    "merchant": { "value": string|null, "confidence": "high"|"low" },',
    '    "amount": { "value": number|null, "confidence": "high"|"low" },',
    '    "currency": { "value": string|null, "confidence": "high"|"low" },',
    '    "date": { "value": string|null, "confidence": "high"|"low" },',
    '    "time": { "value": string|null, "confidence": "high"|"low" },',
    '    "type": { "value": "expense"|"income"|null, "confidence": "high"|"low" },',
    '    "paymentMethod": { "value": string|null, "confidence": "high"|"low" },',
    '    "categoryName": { "value": string|null, "confidence": "high"|"low" },',
    '    "subcategoryName": { "value": string|null, "confidence": "high"|"low" },',
    '    "referenceId": { "value": string|null, "confidence": "high"|"low" },',
    '    "invoiceNumber": { "value": string|null, "confidence": "high"|"low" },',
    '    "subtotal": { "value": number|null, "confidence": "high"|"low" },',
    '    "tax": { "value": number|null, "confidence": "high"|"low" },',
    '    "discount": { "value": number|null, "confidence": "high"|"low" },',
    '    "note": { "value": string|null, "confidence": "high"|"low" }',
    '  },',
    '  "lineItems": [ { "name": string, "qty": number|null, "amount": number|null } ],',
    '  "sourceKind": "gpay"|"phonepe"|"paytm"|"bank"|"upi"|"receipt"|"invoice"|"other",',
    '  "warnings": [ string ]',
    '}',
    'Every key under "transaction" must be present. "lineItems" may be []. "warnings" may be [].',
  ].join('\n');
}

// A flat, name-only view of the user's category tree. Resolution on the
// client is by name (mapping.ts), so ids aren't needed in the prompt.
function categoryOutline(categories) {
  const byId = new Map((categories || []).map((c) => [c.id, c]));
  const roots = (categories || []).filter((c) => !c.parentId);
  const lines = [];
  for (const root of roots) {
    lines.push(`- ${root.name}`);
    for (const child of (categories || []).filter((c) => c.parentId === root.id)) {
      lines.push(`  - ${child.name}  (under ${root.name})`);
    }
  }
  // Orphans (a child whose parent isn't in the list) — still offer them.
  for (const c of (categories || []).filter((c) => c.parentId && !byId.has(c.parentId))) {
    lines.push(`- ${c.name}`);
  }
  return lines.join('\n') || '(none configured)';
}

function buildContextText(hints, categories, usableCount) {
  const h = hints && typeof hints === 'object' ? hints : {};
  return [
    `Today is ${h.todayISO || new Date().toISOString().slice(0, 10)}. User locale: ${h.localeTag || 'en'}. Default currency if the image shows none: ${h.defaultCurrency || 'INR'}.`,
    `${usableCount} image(s) follow, in order — treat them as one transaction.`,
    '',
    'Category list (use these exact names for categoryName / subcategoryName, or null):',
    categoryOutline(categories),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// response parsing + normalisation
// ---------------------------------------------------------------------------

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function coerceField(raw, kind) {
  const isWrapped = raw && typeof raw === 'object' && !Array.isArray(raw);
  let value = isWrapped ? raw.value : raw;
  const rawConf = isWrapped ? raw.confidence : undefined;
  if (value === undefined) value = null;
  if (value !== null) {
    if (kind === 'number') value = toNumber(value);
    else {
      value = String(value).trim();
      if (!value || /^(null|n\/a|unknown|-)$/i.test(value)) value = null;
    }
  }
  return { value, confidence: value === null ? 'low' : rawConf === 'high' ? 'high' : 'low' };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Force whatever the model returned into the exact ScanResult shape the
// mobile client expects — every transaction.* key present, numbers coerced,
// enums clamped, unreadable/invalid values collapsed to { null, "low" }.
function normalizeResult(parsed, { imageCount } = {}) {
  const src = parsed && typeof parsed === 'object' ? parsed : {};
  const srcTxn = src.transaction && typeof src.transaction === 'object' ? src.transaction : {};

  const transaction = {};
  for (const [key, kind] of Object.entries(TXN_FIELDS)) {
    transaction[key] = coerceField(srcTxn[key], kind);
  }

  // Field-specific validation on top of the generic coercion.
  if (transaction.currency.value) {
    const code = transaction.currency.value.toUpperCase();
    transaction.currency = /^[A-Z]{3}$/.test(code)
      ? { value: code, confidence: transaction.currency.confidence }
      : { value: null, confidence: 'low' };
  }
  if (transaction.date.value && (!DATE_RE.test(transaction.date.value) || Number.isNaN(Date.parse(transaction.date.value)))) {
    transaction.date = { value: null, confidence: 'low' };
  }
  if (transaction.time.value && !TIME_RE.test(transaction.time.value)) {
    transaction.time = { value: null, confidence: 'low' };
  }
  if (transaction.type.value && !['expense', 'income'].includes(transaction.type.value)) {
    transaction.type = { value: null, confidence: 'low' };
  }

  const lineItems = Array.isArray(src.lineItems)
    ? src.lineItems
        .slice(0, 50)
        .map((li) => ({
          name: li && li.name != null ? String(li.name).trim() : '',
          qty: toNumber(li && li.qty),
          amount: toNumber(li && li.amount),
        }))
        .filter((li) => li.name)
    : [];

  const warnings = Array.isArray(src.warnings)
    ? src.warnings.map((w) => String(w).trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    transaction,
    lineItems,
    sourceKind: SOURCE_KINDS.includes(src.sourceKind) ? src.sourceKind : 'other',
    imageCount: Number.isFinite(imageCount) ? imageCount : 0,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

// files: multer memory-storage parts ({ buffer, mimetype, originalname }).
// Throws tagged errors the route maps to HTTP status:
//   NO_READABLE_IMAGES / NO_TRANSACTION      -> 422 no_transaction_found
//   NO_API_KEY / UPSTREAM_ERROR / BAD_MODEL_OUTPUT / MODEL_REFUSED -> 502 scan_failed
async function scanReceipts({ files, hints, categories }) {
  const client = anthropic(); // fail fast on a missing key, before any work

  const blocks = [];
  let unreadable = 0;
  for (const file of files || []) {
    const block = await toImageBlock(file);
    if (block) blocks.push(block);
    else unreadable += 1;
  }
  if (blocks.length === 0) {
    throw tagged('NO_READABLE_IMAGES', 'no readable images', {
      warnings: ['None of the uploaded images could be read. If they are HEIC photos, try a screenshot or a JPEG/PNG.'],
    });
  }

  const content = [{ type: 'text', text: buildContextText(hints, categories, blocks.length) }];
  blocks.forEach((block, i) => {
    content.push({ type: 'text', text: `Image ${i + 1} of ${blocks.length}:` });
    content.push(block);
  });
  content.push({ type: 'text', text: 'Return only the JSON object now.' });

  let message;
  try {
    message = await client.messages.create({
      model: SCAN_MODEL,
      max_tokens: 6000,
      system: buildSystemPrompt(),
      thinking: { type: 'adaptive' },
      // Extraction, not open-ended reasoning — but the "which number is the
      // amount actually paid" call is worth a little deliberation.
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content }],
    });
  } catch (cause) {
    // Server-side breadcrumb so a misconfigured key / rate limit / timeout
    // is diagnosable. Status + message only — never the images or prompt.
    console.error('[receiptScan] upstream call failed', cause?.status || '', cause?.message || cause);
    throw tagged('UPSTREAM_ERROR', 'vision call failed', { cause });
  }

  if (message.stop_reason === 'refusal') {
    throw tagged('MODEL_REFUSED', 'model declined the request');
  }

  const text = (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const parsed = extractJson(text);
  if (!parsed) throw tagged('BAD_MODEL_OUTPUT', 'model did not return parseable JSON');

  const result = normalizeResult(parsed, { imageCount: (files || []).length });
  if (unreadable > 0) {
    result.warnings.unshift(
      `${unreadable} image${unreadable === 1 ? '' : 's'} could not be read and ${unreadable === 1 ? 'was' : 'were'} skipped.`
    );
  }

  // Nothing usable came back — no merchant AND no amount.
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
  // exported for unit tests
  extractJson,
  normalizeResult,
  buildSystemPrompt,
  buildContextText,
  categoryOutline,
  toNumber,
};
