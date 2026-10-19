import { describe, it, expect } from 'vitest';
import { score, proximity } from '../src/scoring';
import { WEIGHTS, DEFAULT_THRESHOLD } from '../src/scoring/weights';
import type { NewEvent, ProximityReason } from '../src/types';

type E = Pick<NewEvent, 'scope' | 'country' | 'severity'>;
const rows: [string, E, number, ProximityReason, boolean, boolean][] = [
  ['HU news', { scope: 'country', country: 'HU', severity: 0.5 }, 0.5, 'home', false, true],
  ['NP news', { scope: 'country', country: 'NP', severity: 0.5 }, 0.1, 'elsewhere', false, false],
  ['NP breaking', { scope: 'country', country: 'NP', severity: 0.8 }, 0.16, 'elsewhere', false, false],
  ['global news', { scope: 'global', country: null, severity: 0.5 }, 0.4, 'global', false, false],
  ['global breaking', { scope: 'global', country: null, severity: 0.8 }, 0.64, 'global', false, true],
  ['NP red quake', { scope: 'country', country: 'NP', severity: 1.0 }, 1.0, 'elsewhere', true, true],
  ['RO orange flood', { scope: 'country', country: 'RO', severity: 0.7 }, 0.525, 'subregion', false, true],
  ['ES orange flood', { scope: 'country', country: 'ES', severity: 0.7 }, 0.28, 'continent', false, false],
  ['unknown quake', { scope: 'unknown', country: null, severity: 0.7 }, 0.14, 'unknown', false, false],
  ['BTC -3%', { scope: 'global', country: null, severity: 0.5 }, 0.4, 'global', false, false],
  ['BTC -4%', { scope: 'global', country: null, severity: 4 / 6 }, 0.5333, 'global', false, true],
  ['BTC -6%', { scope: 'global', country: null, severity: 1.0 }, 1.0, 'global', true, true],
];

describe('score (design §8)', () => {
  it.each(rows)('%s', (_n, ev, importance, reason, override, fires) => {
    const s = score(ev, 'HU', 0.5);
    expect(s.importance).toBeCloseTo(importance, 3);
    expect(s.proximityReason).toBe(reason);
    expect(s.override).toBe(override);
    expect(s.fires).toBe(fires);
    expect(s.threshold).toBe(0.5);
  });

  it('XK event with home HU is elsewhere', () => {
    expect(proximity({ scope: 'country', country: 'XK' }, 'HU')).toEqual({ weight: WEIGHTS.elsewhere, reason: 'elsewhere' });
  });
  it('XK event with home XK is home', () => {
    expect(proximity({ scope: 'country', country: 'XK' }, 'XK')).toEqual({ weight: WEIGHTS.home, reason: 'home' });
  });
  it('home missing from table makes others elsewhere', () => {
    expect(proximity({ scope: 'country', country: 'HU' }, 'XK').reason).toBe('elsewhere');
  });
  it('empty sub-region is not "same subregion" (AQ vs AQ is home, AQ vs HU elsewhere)', () => {
    expect(proximity({ scope: 'country', country: 'AQ' }, 'HU').reason).toBe('elsewhere');
    expect(proximity({ scope: 'country', country: 'HU' }, 'AQ').reason).toBe('elsewhere');
  });
  it('fires uses epsilon at the threshold', () => {
    expect(score({ scope: 'country', country: 'HU', severity: 0.5 }, 'HU', 0.5 + 1e-10).fires).toBe(true);
  });
  it('default threshold', () => expect(DEFAULT_THRESHOLD).toBe(0.5));
});
