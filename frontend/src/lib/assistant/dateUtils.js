// Small local date-parsing helpers for the assistant's natural-language
// intents ("compare June vs July", "show June expenses"). Deliberately
// simple/keyword-based — this is not a general NLP date parser, just enough
// to resolve month names and a couple of relative phrases against the
// current year (falling back to last year if the named month hasn't
// happened yet this year, e.g. asking for "December" in February).
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function monthLabel(year, month) {
  return `${MONTH_NAMES[month][0].toUpperCase()}${MONTH_NAMES[month].slice(1)} ${year}`;
}

export function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function previousMonth({ year, month }) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

export function monthRange(year, month) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { dateFrom: iso(from), dateTo: iso(to) };
}

// Finds every month name mentioned in free text, in reading order, resolving
// each to the most recent occurrence of that month (this year, or last year
// if it hasn't happened yet). Used for "compare June vs July" style queries.
export function findMonthMentions(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  const found = [];
  MONTH_NAMES.forEach((name, month) => {
    const idx = lower.indexOf(name);
    if (idx === -1) return;
    let year = now.getFullYear();
    if (month > now.getMonth()) year -= 1;
    found.push({ idx, year, month });
  });
  return found.sort((a, b) => a.idx - b.idx).map(({ year, month }) => ({ year, month }));
}
