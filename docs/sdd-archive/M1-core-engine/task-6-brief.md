### Task 6: Channel adapters and registry

**Files:**
- Create: `server/src/channels/{index,email,slack,message}.ts`
- Test: `server/test/channels.test.ts`

**Interfaces:**
- Produces: `ChannelAdapter<C>` exactly as in design §10. `AlertMessage = { title: string; summary: string | null; url: string | null; category: Category; country: string | null; importance: number; reason: string }`.
- Produces: `buildMessage(event: EventRow, b: ScoreBreakdown): AlertMessage`. `reason` is for example `"importance 0.53 = severity 0.67 × 0.8 (global) ≥ threshold 0.5"`, or `"… critical override (severity ≥ 0.9)"`.
- Produces: `createChannelRegistry(opts: { smtpUrl?: string; outboxDir: string; slackDryRun: boolean; fetchImpl?: typeof fetch; log: (msg: string) => void }): Record<'email'|'slack', ChannelAdapter<any>>`.
- Produces: `scrubSecrets(text: string, config: unknown): string`. It replaces any string value of `config` longer than 8 chars that appears in `text` with `***`.
- email config `{ to: z.email() }`. Without `smtpUrl`, it uses nodemailer `jsonTransport` and writes `<outboxDir>/<timestamp>-<to>.json`.
- slack config `{ webhookUrl: z.url().startsWith('https://hooks.slack.com/') }`. It POSTs JSON `{ text }` through `fetchImpl`, and a non-2xx response throws `Slack responded <status>`. In dry-run mode it calls `log` with the text and doesn't fetch.

- [ ] **Step 1: Write the failing tests:**
  - email without smtp writes one JSON file in a temp dir containing the title.
  - slack calls `fetchImpl` once with the URL and a body containing the title.
  - slack throws on a 500 response.
  - The slack schema rejects `http://example.com`.
  - **Review Focus 2:** `maskConfig({webhookUrl:'https://hooks.slack.com/services/T0/B0/abcdSECRET1234'})` returns a string that contains `1234` and not `SECRET`. `scrubSecrets('failed https://hooks.slack.com/services/T0/B0/abcdSECRET1234', cfg)` doesn't contain `SECRET`.
  - `buildMessage` reason strings for a normal case and an override case.
- [ ] **Step 2–4:** Fail → implement → pass.
- [ ] **Step 5: Commit** `feat(server): email and slack channel adapters with secret masking`

