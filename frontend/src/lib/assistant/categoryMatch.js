// Categories are user-defined, so "grocery spending" has to be resolved
// against whatever the user actually named their categories, not a fixed
// id. Synonyms cover the common phrasing from the suggested-question chips
// (restaurant/coffee/grocery/fuel) so those still work for users who named
// their category "Dining Out" or "Gas" instead of the literal word.
const SYNONYMS = {
  restaurant: ['restaurant', 'dining', 'eating out', 'food'],
  coffee: ['coffee', 'cafe', 'café'],
  grocery: ['grocery', 'groceries', 'supermarket'],
  fuel: ['fuel', 'gas', 'petrol'],
  transportation: ['transport', 'transportation', 'commute', 'uber', 'taxi', 'ride'],
  shopping: ['shopping', 'retail'],
  entertainment: ['entertainment', 'movies', 'streaming'],
  housing: ['housing', 'rent', 'mortgage'],
  utilities: ['utilities', 'utility', 'electricity', 'water bill'],
};

export function expandSynonyms(keyword) {
  const k = keyword.toLowerCase();
  return SYNONYMS[k] || [k];
}

export function matchCategory(categories, keyword) {
  if (!categories?.length || !keyword) return null;
  const needles = expandSynonyms(keyword);
  return (
    categories.find((c) => needles.some((n) => c.name.toLowerCase().includes(n))) || null
  );
}

// Synchronous keyword-only lookup (no fetch needed) so free-text intent
// matching can recognize "show grocery spending" before any category data
// has loaded; the resulting key is resolved against the user's real
// categories later, inside the handler, via matchCategory above.
export function findSynonymKeyInText(text) {
  const lower = (text || '').toLowerCase();
  const entry = Object.entries(SYNONYMS).find(([, needles]) => needles.some((n) => lower.includes(n)));
  return entry ? entry[0] : null;
}
