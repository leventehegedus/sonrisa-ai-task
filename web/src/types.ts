// shortcut: hand-copied API types, share them from the server if they drift
export type Me = { id: number; name: string; email: string; homeCountry: string; isAdmin: boolean }
export type UserSummary = { id: number; name: string }
export type ApiError = { error: string; issues?: unknown[] }
export type Category = 'news' | 'market' | 'disaster'
export type ProximityReason = 'home' | 'subregion' | 'continent' | 'elsewhere' | 'global' | 'unknown'
export type ScoreBreakdown = { severity: number; proximity: number; proximityReason: ProximityReason; override: boolean; importance: number; threshold: number; fires: boolean }
export type Rule = { id: number; name: string; categories: Category[]; keywords: string[]; threshold: number; channelIds: number[]; enabled: boolean }
export type RuleInput = Omit<Rule, 'id'>
export type Channel = { id: number; type: string; config: Record<string, string>; enabled: boolean }
export type ChannelInput = { type: string; config: Record<string, string>; enabled?: boolean }
export type ChannelPatch = { id: number; config?: Record<string, string>; enabled?: boolean }
export type TestResult = { ok: boolean; error?: string }
export type MyDelivery = {
  id: number
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
  channelId: number | null
  ruleId: number | null
  breakdown: ScoreBreakdown
  event: { id: number; title: string; category: Category; country: string | null; scope: string; url: string | null; occurredAt: string }
}
