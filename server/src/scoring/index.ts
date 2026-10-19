import { lookupCountry } from '../geo';
import type { NewEvent, ProximityReason, ScoreBreakdown } from '../types';
import { CRITICAL_SEVERITY, EPSILON, WEIGHTS } from './weights';

export function proximity(event: Pick<NewEvent, 'scope' | 'country'>, homeCountry: string): { weight: number; reason: ProximityReason } {
  const w = (reason: ProximityReason) => ({ weight: WEIGHTS[reason], reason });
  if (event.scope === 'global') return w('global');
  if (event.scope === 'unknown' || !event.country) return w('unknown');
  if (event.country === homeCountry) return w('home');
  const ev = lookupCountry(event.country);
  const home = lookupCountry(homeCountry);
  if (!ev || !home) return w('elsewhere');
  // Empty sub-region/region (e.g. Antarctica) never counts as a match.
  if (ev.subregion && ev.subregion === home.subregion) return w('subregion');
  if (ev.region && ev.region === home.region) return w('continent');
  return w('elsewhere');
}

export function score(event: Pick<NewEvent, 'scope' | 'country' | 'severity'>, homeCountry: string, threshold: number): ScoreBreakdown {
  const { weight, reason } = proximity(event, homeCountry);
  const override = event.severity >= CRITICAL_SEVERITY;
  const base = event.severity * weight;
  const importance = override ? Math.max(base, event.severity) : base;
  return { severity: event.severity, proximity: weight, proximityReason: reason, override, importance, threshold, fires: importance >= threshold - EPSILON };
}
