import { describe, it, expect } from 'vitest';
import { lookupCountry, iso3ToIso2 } from '../src/geo';

describe('geo', () => {
  it.each([
    ['HU', 'HUN', 'Europe', 'Eastern Europe'],
    ['AT', 'AUT', 'Europe', 'Western Europe'],
    ['RO', 'ROU', 'Europe', 'Eastern Europe'],
    ['NP', 'NPL', 'Asia', 'Southern Asia'],
  ])('lookupCountry(%s)', (iso2, iso3, region, subregion) => {
    expect(lookupCountry(iso2)).toEqual({ iso2, iso3, region, subregion });
  });
  it('handles quoted names with commas', () => expect(lookupCountry('KR')).toBeDefined());
  it('XK is not in the table', () => expect(lookupCountry('XK')).toBeUndefined());
  it('iso3ToIso2', () => {
    expect(iso3ToIso2('VUT')).toBe('VU');
    expect(iso3ToIso2('XXX')).toBeUndefined();
  });
  it('Antarctica has empty region/subregion', () => {
    expect(lookupCountry('AQ')).toMatchObject({ region: '', subregion: '' });
  });
});
