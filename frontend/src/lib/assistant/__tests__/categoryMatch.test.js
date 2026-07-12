import { describe, it, expect } from 'vitest';
import { expandSynonyms, matchCategory, findSynonymKeyInText } from '../categoryMatch.js';

describe('expandSynonyms', () => {
  it('expands a known synonym key to its full list of synonyms', () => {
    expect(expandSynonyms('coffee')).toEqual(['coffee', 'cafe', 'café']);
  });

  it('is case-insensitive on the key', () => {
    expect(expandSynonyms('COFFEE')).toEqual(['coffee', 'cafe', 'café']);
  });

  it('returns the keyword itself as a single-element array when there is no synonym entry', () => {
    expect(expandSynonyms('subscriptions')).toEqual(['subscriptions']);
  });

  it('expands fuel synonyms', () => {
    expect(expandSynonyms('fuel')).toEqual(['fuel', 'gas', 'petrol']);
  });
});

describe('matchCategory', () => {
  const categories = [
    { id: 1, name: 'Dining Out' },
    { id: 2, name: 'Gas & Fuel' },
    { id: 3, name: 'Groceries' },
    { id: 4, name: 'Rent' },
  ];

  it('matches a category whose name contains a synonym for the keyword', () => {
    expect(matchCategory(categories, 'restaurant')).toEqual({ id: 1, name: 'Dining Out' });
  });

  it('matches via a synonym even when the literal keyword is not in the category name', () => {
    // "fuel" keyword expands to include "gas", which matches "Gas & Fuel" anyway,
    // but also verifies the literal category name "Gas & Fuel" matches "fuel" itself.
    expect(matchCategory(categories, 'fuel')).toEqual({ id: 2, name: 'Gas & Fuel' });
  });

  it('matches "grocery" against a category literally named "Groceries"', () => {
    expect(matchCategory(categories, 'grocery')).toEqual({ id: 3, name: 'Groceries' });
  });

  it('matches "housing" against a category named "Rent" via synonym expansion', () => {
    expect(matchCategory(categories, 'housing')).toEqual({ id: 4, name: 'Rent' });
  });

  it('returns null when no category matches', () => {
    expect(matchCategory(categories, 'entertainment')).toBeNull();
  });

  it('returns null for an empty categories array', () => {
    expect(matchCategory([], 'restaurant')).toBeNull();
  });

  it('returns null for a null/undefined categories list', () => {
    expect(matchCategory(null, 'restaurant')).toBeNull();
    expect(matchCategory(undefined, 'restaurant')).toBeNull();
  });

  it('returns null for an empty/falsy keyword', () => {
    expect(matchCategory(categories, '')).toBeNull();
  });
});

describe('findSynonymKeyInText', () => {
  it('finds the synonym key for a mentioned word', () => {
    expect(findSynonymKeyInText('How much did I spend on coffee?')).toBe('coffee');
  });

  it('finds the synonym key via a synonym phrase, not just the key itself', () => {
    expect(findSynonymKeyInText('What is my grocery spending')).toBe('grocery');
    expect(findSynonymKeyInText('supermarket expenses')).toBe('grocery');
  });

  it('is case-insensitive', () => {
    expect(findSynonymKeyInText('COFFEE spending')).toBe('coffee');
  });

  it('returns null when no synonym is mentioned', () => {
    expect(findSynonymKeyInText('Show my account balances')).toBeNull();
  });

  it('returns null for empty/falsy text', () => {
    expect(findSynonymKeyInText('')).toBeNull();
    expect(findSynonymKeyInText(undefined)).toBeNull();
  });

  it('matches transportation synonyms like "uber" and "taxi"', () => {
    expect(findSynonymKeyInText('I took an uber home')).toBe('transportation');
    expect(findSynonymKeyInText('paid for a taxi')).toBe('transportation');
  });
});
