Ruling: the workspace is archived to `docs/sdd-archive/<milestone>/` at each milestone gate instead of being deleted — the user wants intermediate outputs as evidence — cost if wrong: a few hundred KB of extra docs.
Task 1: minor (deferred): server dev script points at src/index.ts (plan: Task 10 sets `tsx watch src/main.ts`)
Task 1: minor (deferred): NULL channel_id bypasses UNIQUE(event_id, channel_id) — ingest/dispatch must never insert NULL channel_id
Task 1: minor (deferred): no test that deliveries.rule_id → NULL on rule delete; no indexes on deliveries(status,next_attempt_at)
Ruling: commit trailers name the model that actually authored the commit (Sonnet trailer on 65da286 kept, not amended) — honest attribution beats a uniform trailer — cost if wrong: cosmetic
Task 2: minor (deferred): scoring.test.ts:43 title claims "AQ vs AQ is home" but doesn't assert it (misleading test name)
Task 2: minor (deferred): epsilon test covers only the just-below side
Task 3: Ruling: R-P9 added — RED must be assertion failures via stubs — closes the evidence gap the Task 3 review found for all later tasks — cost if wrong: one extra step per task
Task 3: minor (deferred): keyword can match across title/summary boundary (controller-specified join)
Task 4: Ruling: review Minor 1 (z.url accepts javascript:/file:) upgraded to Important — event.url is rendered as a link in the web UI and sent in alerts (XSS / phishing vector via admin inject or hostile feed) — cost if wrong: a one-line refine
Task 4: Ruling: review Minor 4 (externalId '' when no guid/link/title) upgraded to Important — empty ids collide on UNIQUE(source, external_id) and silently drop later events — cost if wrong: one line + test
Task 4: minor (deferred): tags stripped before entity decode → double-encoded HTML survives as tags (summaries rendered as text, not HTML; revisit if HTML email)
Task 4: minor (deferred): valid empty <channel/> throws instead of returning []
Task 4: minor (deferred): coin missing from body skipped silently vs null change rejects whole body (inconsistent)
Task 4: minor (deferred): tests lack 23:30Z UTC-date case and 3% boundary case
Task 4: minor (deferred): skipped id-less RSS items are silent (no count/log)
Task 5: minor (deferred): ingest.ts:21 `(r as any).id` — map with rowToUser first
Task 5: minor (deferred): rows.ts untyped row param lacks shortcut: comment; no raw round-trip assertion
Task 6: Ruling: spec §10 "outbox mode writes each message to the log" is binding over the brief's omission — email adapter gets `log` and logs one line (to + subject, no secrets) in outbox mode — cost if wrong: one log line
Task 6: Ruling: Minor "slack fetch has no timeout" upgraded to Important — scheduler tick is re-entrancy-guarded and sequential, so one hung webhook stalls all polling and dispatch — AbortSignal.timeout(10_000) — cost if wrong: none
Task 6: Ruling: also wrap fetch rejections as `Slack request failed: <err.name>` (no message passthrough) — cheap defence in depth for secret leakage — cost if wrong: less detailed error text
Task 6: minor (deferred): no look-alike-host regression test for slack schema; ENAMETOOLONG for very long addresses; transport recreated per send; String(info.message) cast
Task 7: Ruling: Minor "markSent inside same try as send → DB error after a successful send causes retry + duplicate send" upgraded to Important — duplicate alerts are a spec anti-goal (§4) — cost if wrong: small restructure
Task 7: Ruling: Minor "corrupt score_breakdown / missing event retried as transient" upgraded to Important, bundled with the above (same code region) — permanent failures must not retry — cost if wrong: one branch + test
Task 7: minor (deferred): non-Error throws untested; 50-row LIMIT untested; `void user; void channel;` noise in dispatch.test.ts:180; nonexistent channel row reported as 'channel disabled'
Task 7: Ruling: accept at-least-once delivery when the DB write after a successful send fails (implementer concern) — exactly-once to an external webhook is not achievable without idempotency keys on the receiver; SQLite in-process write failure is rare — final review should check a `shortcut:` comment documents it — cost if wrong: a rare duplicate alert
Task 8: minor (deferred): throwing deps.log rejects the tick (add catch in tick); drop-deliveries test lacks assertions; final UPDATE failure reports inserted:0 after commit; malformed last_polled_at → julianday NULL → never due; row:any in poll.ts; 'poll error:' branch untested; sequential slow sources delay dispatch
