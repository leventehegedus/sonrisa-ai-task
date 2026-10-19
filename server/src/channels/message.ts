import type { Category, EventRow, ScoreBreakdown } from '../types';
import { CRITICAL_SEVERITY } from '../scoring/weights';

export interface AlertMessage { title: string; summary: string | null; url: string | null; category: Category; country: string | null; importance: number; reason: string }

export function buildMessage(event: EventRow, b: ScoreBreakdown): AlertMessage {
  const how = b.override
    ? `critical override (severity ${b.severity.toFixed(2)} ≥ ${CRITICAL_SEVERITY})`
    : `severity ${b.severity.toFixed(2)} × ${String(b.proximity)} (${b.proximityReason})`;
  const reason = `importance ${b.importance.toFixed(2)} = ${how} ${b.fires ? '≥' : '<'} threshold ${b.threshold}`;
  return { title: event.title, summary: event.summary, url: event.url, category: event.category, country: event.country, importance: b.importance, reason };
}
