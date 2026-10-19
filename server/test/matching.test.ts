import { describe, it, expect } from 'vitest';
import { matchesContent, evaluate } from '../src/matching';
import type { EventRow, Rule, User } from '../src/types';

const ev = (o: Partial<EventRow> = {}): EventRow => ({
  id: 1, source: 's', externalId: 'x', category: 'news', title: 'Title', summary: null, url: null,
  scope: 'global', country: null, severity: 0.5, occurredAt: '2026-10-19T00:00:00Z', raw: null, ...o,
});
const rule = (o: Partial<Rule> = {}): Rule => ({
  id: 1, userId: 1, name: 'r', categories: [], keywords: [], threshold: 0.5, channelIds: [], enabled: true, ...o,
});
const hu: User = { id: 1, name: 'A', email: 'a@b.c', homeCountry: 'HU', isAdmin: false };

describe('matchesContent', () => {
  it('empty categories and keywords match anything', () => {
    expect(matchesContent(rule(), ev())).toBe(true);
  });
  it('category mismatch is false', () => {
    expect(matchesContent(rule({ categories: ['market'] }), ev())).toBe(false);
    expect(matchesContent(rule({ categories: ['market', 'news'] }), ev())).toBe(true);
  });
  it('keywords are OR, case-insensitive, over title and summary', () => {
    const e = ev({ title: 'Storm warning', summary: 'Heavy RAIN expected' });
    expect(matchesContent(rule({ keywords: ['nope', 'rain'] }), e)).toBe(true);
    expect(matchesContent(rule({ keywords: ['STORM'] }), e)).toBe(true);
    expect(matchesContent(rule({ keywords: ['nope'] }), e)).toBe(false);
  });
  it('matches accented Hungarian keywords case-insensitively', () => {
    expect(matchesContent(rule({ keywords: ['árvíz'] }), ev({ title: 'ÁRVÍZ Szegeden' }))).toBe(true);
  });
  it('treats regex metacharacters literally', () => {
    expect(matchesContent(rule({ keywords: ['(BTC)'] }), ev({ title: 'Bitcoin (BTC) falls' }))).toBe(true);
    expect(matchesContent(rule({ keywords: ['(BTC)'] }), ev({ title: 'BTC falls' }))).toBe(false);
    expect(matchesContent(rule({ keywords: ['c++'] }), ev({ title: 'Learning c++ today' }))).toBe(true);
  });
  it('ignores blank keywords', () => {
    expect(matchesContent(rule({ keywords: ['  '] }), ev())).toBe(true);
    expect(matchesContent(rule({ keywords: ['', ' ', 'zzz'] }), ev())).toBe(false);
  });
});

describe('evaluate', () => {
  it('returns null for a disabled rule', () => {
    expect(evaluate(rule({ enabled: false }), hu, ev())).toBeNull();
  });
  it('returns null when content does not match', () => {
    expect(evaluate(rule({ categories: ['disaster'] }), hu, ev())).toBeNull();
  });
  it('HU user, threshold 0.3, global 0.5 event fires', () => {
    const r = evaluate(rule({ threshold: 0.3 }), hu, ev({ severity: 0.5 }));
    expect(r?.fires).toBe(true);
  });
});
