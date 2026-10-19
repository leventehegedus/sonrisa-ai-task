# 008 — Far-away critical events must still pass by default

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5) + superpowers:brainstorming, caveman, ponytail; a general-purpose subagent for the builder check

## Prompt

```text
yes pls. Really important event should be able to reach the threshold limit by default.
```

(This answers the agent's question: "Should a huge far-away event, like a magnitude 8 earthquake in Nepal, still reach a user in Hungary on default settings?")

## Outcome

1. **Checked the data sources before writing them into the design.** Live `curl` probes:
   - USGS: 3 of 26 events had no country, so it was rejected.
   - GDACS: multi-hazard, with an ISO3 country code and an alert level, so it was adopted.
   - CoinGecko: `200`, no key needed.
   - Frankfurter: `301`, so it was rejected.
   - RSS (telex, hvg, BBC): all `200`.

   The raw responses are saved to `docs/evidence/feed-probes-2026-10-19/`.
2. Wrote the design doc: [`docs/superpowers/specs/2026-10-19-world-alerts-design.md`](../docs/superpowers/specs/2026-10-19-world-alerts-design.md).
3. **Builder check:** a fresh subagent read the design cold. Its findings were sorted:
   - **The user's call (Q1):** the agent's own weights meant no news or market event would ever alert by default (R-004). The weights were revised and the 12 examples recomputed with a script (0 mismatches). Waiting for user approval.
   - **Agent's call:** GDACS escalation dedup (R-007), the `unknown` event scope (R-008), and the missing channel-test endpoint.
   - **Already answered:** the design cited artifacts that didn't exist yet (R-006). They were created: `docs/ai-review-log.md`, D-008 to D-010, and the saved feed responses.
4. Started [`docs/ai-review-log.md`](../docs/ai-review-log.md) with entries R-001 to R-008.

## Decisions

- D-008: Data sources (verified live).
- D-009: Region-weighted score plus critical override (weights proposed, waiting for approval).
- D-010: Event scope, GDACS escalation dedup, channel test endpoint.

## Commit

_pending — backfilled in the next commit_
