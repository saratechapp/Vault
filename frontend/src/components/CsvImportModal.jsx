import { useMemo, useState } from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { Modal, Button, Field, Select } from './ui/index.js';
import { parseCSV } from '../lib/csv.js';
import { transactionsApi } from '../lib/api.js';

const FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'vendor', label: 'Vendor / Description', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'type', label: 'Type (income/expense/transfer)', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'account', label: 'Account', required: false },
  { key: 'paymentMethod', label: 'Payment method', required: false },
  { key: 'note', label: 'Note', required: false },
];

const HEADER_DICT = {
  date: ['date', 'transactiondate', 'txndate'],
  vendor: ['vendor', 'payee', 'description', 'merchant', 'name'],
  amount: ['amount', 'value', 'sum'],
  type: ['type', 'transactiontype'],
  category: ['category', 'categoryname'],
  account: ['account', 'accountname'],
  paymentMethod: ['paymentmethod', 'method', 'mode'],
  note: ['note', 'notes', 'memo'],
};

function normalize(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function guessMapping(headers) {
  const mapping = {};
  const normalized = headers.map(normalize);
  Object.entries(HEADER_DICT).forEach(([field, candidates]) => {
    const idx = normalized.findIndex((h) => candidates.includes(h));
    if (idx !== -1) mapping[field] = headers[idx];
  });
  return mapping;
}

export default function CsvImportModal({ open, onClose, categories, accounts, onImported }) {
  const [stage, setStage] = useState('drop');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [defaultAccountId, setDefaultAccountId] = useState(accounts[0]?.id || '');
  const [defaultCategoryId, setDefaultCategoryId] = useState(categories[0]?.id || '');
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStage('drop');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError('');
    setImportedCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file) {
    setError('');
    const text = await file.text();
    const { headers: h, rows: r } = parseCSV(text);
    if (!h.length) return setError('Could not read any rows from that file.');
    setHeaders(h);
    setRows(r);
    setMapping(guessMapping(h));
    setStage('map');
  }

  const preview = useMemo(() => {
    const colIndex = (field) => headers.indexOf(mapping[field]);
    return rows.slice(0, 5).map((row) => {
      const get = (field) => {
        const idx = colIndex(field);
        return idx === -1 ? '' : row[idx];
      };
      return { date: get('date'), vendor: get('vendor'), amount: get('amount'), category: get('category'), type: get('type') };
    });
  }, [rows, headers, mapping]);

  function buildPayloads() {
    const colIndex = (field) => headers.indexOf(mapping[field]);
    return rows.map((row) => {
      const get = (field) => {
        const idx = colIndex(field);
        return idx === -1 ? '' : (row[idx] || '').trim();
      };
      const rawAmount = Number(String(get('amount')).replace(/[^0-9.-]/g, '')) || 0;
      let type = get('type').toLowerCase();
      if (!['income', 'expense', 'transfer'].includes(type)) {
        type = rawAmount < 0 ? 'expense' : 'income';
      }
      const catName = get('category').toLowerCase();
      const category = categories.find((c) => c.name.toLowerCase() === catName);
      const accName = get('account').toLowerCase();
      const account = accounts.find((a) => a.name.toLowerCase() === accName);
      return {
        date: get('date') || new Date().toISOString().slice(0, 10),
        vendor: get('vendor'),
        amount: Math.abs(rawAmount),
        type,
        categoryId: category?.id || defaultCategoryId,
        accountId: account?.id || defaultAccountId,
        paymentMethod: get('paymentMethod'),
        note: get('note'),
      };
    });
  }

  async function handleImport() {
    setSubmitting(true);
    setError('');
    try {
      const payloads = buildPayloads();
      const res = await transactionsApi.bulk(payloads);
      setImportedCount(res?.count ?? payloads.length);
      setStage('success');
      onImported?.();
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const requiredMapped = FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  return (
    <Modal open={open} onClose={handleClose} title="Import transactions" size="lg">
      {stage === 'drop' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-14 text-center transition ${
            dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-line'
          }`}
        >
          <UploadCloud size={32} className="text-subtle" />
          <p className="text-sm font-medium text-fg">Drop a CSV file here</p>
          <p className="text-xs text-subtle">or</p>
          <label className="btn-outline cursor-pointer">
            Browse files
            <input
              type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {error && <p className="text-sm text-rose-500">{error}</p>}
        </div>
      )}

      {stage === 'map' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`}>
                <Select value={mapping[f.key] || ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">Not mapped</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Field label="Default account" hint="Used when a row has no matching account column.">
              <Select value={defaultAccountId} onChange={(e) => setDefaultAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Default category" hint="Used when a row has no matching category column.">
              <Select value={defaultCategoryId} onChange={(e) => setDefaultCategoryId(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Preview (first {preview.length} rows)</p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-subtle">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2">{r.date || '—'}</td>
                      <td className="px-3 py-2">{r.vendor || '—'}</td>
                      <td className="px-3 py-2">{r.type || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.amount || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setStage('drop')}>Back</Button>
            <Button disabled={!requiredMapped || submitting} onClick={handleImport}>
              {submitting ? 'Importing…' : `Import ${rows.length} rows`}
            </Button>
          </div>
        </div>
      )}

      {stage === 'success' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={26} />
          </div>
          <p className="font-display text-lg font-semibold text-fg">{importedCount} transactions imported</p>
          <p className="text-sm text-muted">Your transactions list has been refreshed.</p>
          <Button onClick={handleClose} className="mt-2">Done</Button>
        </div>
      )}
    </Modal>
  );
}
