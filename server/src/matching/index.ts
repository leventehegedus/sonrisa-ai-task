import { score } from '../scoring';
import type { EventRow, NewEvent, Rule, ScoreBreakdown, User } from '../types';

const lower = (s: string) => s.toLocaleLowerCase('hu');

export function matchesContent(
  rule: Pick<Rule, 'categories' | 'keywords'>,
  event: Pick<NewEvent, 'category' | 'title' | 'summary'>,
): boolean {
  if (rule.categories.length && !rule.categories.includes(event.category)) return false;
  const keywords = rule.keywords.map((k) => lower(k.trim())).filter(Boolean);
  if (!keywords.length) return true;
  const text = lower(`${event.title} ${event.summary ?? ''}`);
  return keywords.some((k) => text.includes(k));
}

export function evaluate(rule: Rule, user: User, event: EventRow): ScoreBreakdown | null {
  if (!rule.enabled || !matchesContent(rule, event)) return null;
  return score(event, user.homeCountry, rule.threshold);
}
