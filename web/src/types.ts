// shortcut: hand-copied API types, share them from the server if they drift
export type Me = { id: number; name: string; email: string; homeCountry: string; isAdmin: boolean }
export type UserSummary = { id: number; name: string }
export type ApiError = { error: string; issues?: unknown[] }
