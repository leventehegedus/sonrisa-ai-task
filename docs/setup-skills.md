# AI Tooling Setup

This project is built with **Claude Code** and three skill plugins:

| Plugin | Purpose in this project |
|--------|-------------------------|
| [superpowers](https://github.com/obra/superpowers) | Process skills: brainstorming → written design → plan → TDD → review → verification. |
| [caveman](https://github.com/juliusbrussee/caveman) | Terse chat replies (fewer tokens). By its own rules it does **not** apply to docs, commits, code or memory, so process artifacts stay full prose. |
| [ponytail](https://github.com/dietrichgebert/ponytail) | "Lazy senior dev": smallest complete change, no speculative abstraction, but never cut validation, error handling, security or tests. |

## Prerequisites

- Claude Code (tested with `2.1.218`): `claude --version`
- Node.js on the non-interactive shell `PATH` (ponytail's hooks run with `node`; tested with `v24.13.1`): `node --version`

## Install: Option A, from a terminal (what was used here)

```bash
# 1. caveman
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman

# 2. ponytail
claude plugin marketplace add DietrichGebert/ponytail
claude plugin install ponytail@ponytail

# 3. verify
claude plugin list | grep -iE 'caveman|ponytail'
```

Both install at **user scope**, so they're available in every project.

## Install: Option B, inside a Claude Code session

Send each line as a **separate** prompt:

```
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

## After installing

1. Start a new Claude Code session, or run `/reload-plugins` in the current one. Plugins don't load into a session that is already running.
2. Optional: `/plugin configure ponytail@ponytail` sets its 4 optional user-config options. The defaults are fine.
3. Use them:
   - `/caveman` turns terse mode on; `stop caveman` turns it off.
   - `/ponytail [lite|full|ultra]` sets the level (default `full`); `/ponytail-review` reviews a diff for over-engineering.

## Uninstall

```bash
claude plugin uninstall caveman@caveman
claude plugin uninstall ponytail@ponytail
```
