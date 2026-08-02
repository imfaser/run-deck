import { describe, it, expect } from 'vitest';
import { buildTerms, escapeRegExp, collectHighlightRanges } from '@/lib/logHighlight';

describe('buildTerms', () => {
  it('splits whitespace into case-insensitive regexes', () => {
    const terms = buildTerms('foo bar');
    expect(terms).toHaveLength(2);
    expect(terms[0].test('FOO')).toBe(true);
    expect(terms[1].test('bar')).toBe(true);
  });

  it('returns empty array for empty query', () => {
    expect(buildTerms('')).toEqual([]);
    expect(buildTerms('   ')).toEqual([]);
  });
});

describe('escapeRegExp', () => {
  it('escapes regex special chars', () => {
    expect(escapeRegExp('[a.*]')).toBe('\\[a\\.\\*\\]');
  });
});

describe('collectHighlightRanges', () => {
  it('returns empty when no terms', () => {
    expect(collectHighlightRanges('hello world', [])).toEqual([]);
  });

  it('collects single match range', () => {
    expect(collectHighlightRanges('hello world', [/world/i])).toEqual([{ start: 6, end: 11 }]);
  });

  it('merges overlapping ranges into one', () => {
    expect(collectHighlightRanges('foobar', [/foo/, /oob/])).toEqual([{ start: 0, end: 4 }]);
  });

  it('keeps disjoint ranges separate', () => {
    expect(collectHighlightRanges('a b a', [/a/])).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
    ]);
  });

  it('returns empty when no match', () => {
    expect(collectHighlightRanges('hello', [/xyz/i])).toEqual([]);
  });
});
