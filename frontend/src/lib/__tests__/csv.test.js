import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCSV, toCSV, downloadCSV } from '../csv.js';

describe('parseCSV', () => {
  it('parses a simple comma-delimited csv with header + rows', () => {
    const { headers, rows } = parseCSV('name,age\nAlice,30\nBob,25');
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const { headers, rows } = parseCSV('name,note\n"Doe, Jane","Hello, world"');
    expect(headers).toEqual(['name', 'note']);
    expect(rows).toEqual([['Doe, Jane', 'Hello, world']]);
  });

  it('handles quoted fields containing embedded newlines', () => {
    const { headers, rows } = parseCSV('name,note\n"Jane","Line1\nLine2"');
    expect(headers).toEqual(['name', 'note']);
    expect(rows).toEqual([['Jane', 'Line1\nLine2']]);
  });

  it('handles escaped double-quotes inside a quoted field', () => {
    const { headers, rows } = parseCSV('name,quote\n"Jane","She said ""hi"" today"');
    expect(headers).toEqual(['name', 'quote']);
    expect(rows).toEqual([['Jane', 'She said "hi" today']]);
  });

  it('handles CRLF line endings', () => {
    const { headers, rows } = parseCSV('name,age\r\nAlice,30\r\nBob,25');
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  it('handles LF line endings', () => {
    const { headers, rows } = parseCSV('name,age\nAlice,30\nBob,25');
    expect(rows).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  it('ignores a trailing empty line', () => {
    const { headers, rows } = parseCSV('name,age\nAlice,30\n\n');
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([['Alice', '30']]);
  });

  it('trims whitespace from header names', () => {
    const { headers } = parseCSV(' name , age \nAlice,30');
    expect(headers).toEqual(['name', 'age']);
  });

  it('sniffs semicolon delimiter when the first line has more semicolons than commas', () => {
    const { headers, rows } = parseCSV('name;age\nAlice;30\nBob;25');
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  it('keeps comma delimiter when commas outnumber semicolons in the first line', () => {
    const { headers, rows } = parseCSV('name,age\nAlice,30');
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([['Alice', '30']]);
  });

  it('handles semicolon-delimited quoted fields containing commas', () => {
    const { headers, rows } = parseCSV('name;note\n"Doe, Jane";"Hello, world"');
    expect(headers).toEqual(['name', 'note']);
    expect(rows).toEqual([['Doe, Jane', 'Hello, world']]);
  });

  it('returns empty headers/rows for empty input', () => {
    expect(parseCSV('')).toEqual({ headers: [], rows: [] });
  });

  it('returns empty headers/rows for input with only blank lines', () => {
    expect(parseCSV('\n\n\n')).toEqual({ headers: [], rows: [] });
  });

  it('handles a header-only csv (no data rows)', () => {
    const { headers, rows } = parseCSV('name,age');
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([]);
  });
});

describe('toCSV', () => {
  const columns = [
    { header: 'Name', value: (r) => r.name },
    { header: 'Amount', value: (r) => r.amount },
  ];

  it('serializes rows with a comma-joined header and CRLF line endings', () => {
    const csv = toCSV([{ name: 'Alice', amount: 30 }, { name: 'Bob', amount: 25 }], columns);
    expect(csv).toBe('Name,Amount\r\nAlice,30\r\nBob,25');
  });

  it('quotes and escapes fields containing commas, quotes, or newlines', () => {
    const csv = toCSV([{ name: 'Doe, Jane', amount: 'She said "hi"' }], columns);
    expect(csv).toBe('Name,Amount\r\n"Doe, Jane","She said ""hi"""');
  });

  it('quotes fields containing embedded newlines', () => {
    const csv = toCSV([{ name: 'Multi\nLine', amount: 5 }], columns);
    expect(csv).toBe('Name,Amount\r\n"Multi\nLine",5');
  });

  it('renders null/undefined values as empty strings', () => {
    const csv = toCSV([{ name: null, amount: undefined }], columns);
    expect(csv).toBe('Name,Amount\r\n,');
  });

  it('handles an empty rows array (header only)', () => {
    const csv = toCSV([], columns);
    expect(csv).toBe('Name,Amount');
  });
});

describe('parseCSV / toCSV round-trip', () => {
  it('reproduces equivalent data after a round trip through toCSV and parseCSV', () => {
    const original = [
      { name: 'Alice', note: 'Hello, world' },
      { name: 'Bob "The Builder"', note: 'Line1\nLine2' },
      { name: 'Cara', note: '' },
    ];
    const columns = [
      { header: 'Name', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ];
    const csv = toCSV(original, columns);
    const { headers, rows } = parseCSV(csv);
    expect(headers).toEqual(['Name', 'Note']);
    expect(rows).toEqual(original.map((r) => [r.name, r.note]));
  });

  it('round-trips a value that itself looks like CSV syntax', () => {
    const original = [{ name: 'a,b;c', note: '"quoted"' }];
    const columns = [
      { header: 'Name', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ];
    const csv = toCSV(original, columns);
    const { rows } = parseCSV(csv);
    expect(rows).toEqual([[original[0].name, original[0].note]]);
  });
});

describe('downloadCSV', () => {
  let createObjectURL;
  let revokeObjectURL;
  let clickSpy;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it('creates an anchor with the given filename/href, clicks it, and revokes the URL', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    downloadCSV('export.csv', 'a,b\n1,2');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');

    const anchor = appendSpy.mock.calls[0][0];
    expect(anchor.tagName).toBe('A');
    expect(anchor.download).toBe('export.csv');
    expect(anchor.href).toBe('blob:mock-url');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    appendSpy.mockRestore();
  });

  it('does not leave the anchor attached to the DOM afterwards', () => {
    downloadCSV('export.csv', 'a,b\n1,2');
    const anchors = document.querySelectorAll('a[download="export.csv"]');
    expect(anchors.length).toBe(0);
  });
});
