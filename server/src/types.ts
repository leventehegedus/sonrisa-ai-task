export type Category = 'news' | 'market' | 'disaster';
export type Scope = 'country' | 'global' | 'unknown';
export interface NewEvent { source: string; externalId: string; category: Category; title: string; summary: string | null; url: string | null; scope: Scope; country: string | null; severity: number; occurredAt: string; raw: unknown }
export interface EventRow extends NewEvent { id: number }
export interface User { id: number; name: string; email: string; homeCountry: string; isAdmin: boolean }
export interface Rule { id: number; userId: number; name: string; categories: Category[]; keywords: string[]; threshold: number; channelIds: number[]; enabled: boolean }
export type ProximityReason = 'home' | 'subregion' | 'continent' | 'elsewhere' | 'global' | 'unknown';
export interface ScoreBreakdown { severity: number; proximity: number; proximityReason: ProximityReason; override: boolean; importance: number; threshold: number; fires: boolean }
export type DeliveryStatus = 'pending' | 'sent' | 'failed';
