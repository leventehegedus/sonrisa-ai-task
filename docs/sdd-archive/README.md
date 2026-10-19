# Subagent-driven development archive

The raw working artifacts from each milestone, produced by `superpowers:subagent-driven-development`. These are the evidence behind the AI review log:

| File pattern | What it is |
|---|---|
| `progress.md` | The controller's ledger: pre-flight conflict scan, every ruling, every deferred minor, and fix rounds per task |
| `global-constraints.md` | Binding constraints and controller rulings (R-P1..R-P9) handed to every subagent |
| `task-N-brief.md` | Exact task text given to the implementer (extracted from the plan) |
| `task-N-report.md` | The implementer's report: TDD RED/GREEN evidence, fix-round appendices |
| `task-N-review.md` | The independent task reviewer's verdict (spec compliance + quality) |
| `task-N-rereview-R.md` | Scoped re-review after fix round R |
| `review-<base>..<head>.diff` | The exact diff each reviewer saw (diffs over 200 KB, which are fixture copies, are omitted) |
| `final-review-*.md`, `final-fix-*`, `*-rereview.md` | Whole-branch review, its single fix wave, and the re-review |

Every implementer and every reviewer was a fresh subagent with no conversation history. The controller (the main session) never wrote product code. It wrote briefs, made rulings and kept the ledger.
