# 002 — Start the planning phase

**Date:** 2026-10-19
**Tool:** Claude Code (Opus 5.5) + superpowers:brainstorming

## Prompt

```text
okay, that will be fine. Now pls let's step on the planning phase about the task that is in the @docs/task-brief.md , pls go over the whole planning process, analyze the task and give me decisions how to move on with it. At the end of the planning phase I would like to have a plan.md and also an md for claude. I would like to use superpowers skill, also use these skills
https://github.com/juliusbrussee/caveman
https://github.com/dietrichgebert/ponytail
```

## Outcome

- Ran the `superpowers:brainstorming` skill. Its hard gate: no building until the written design is approved.
- Cloned both linked repos to a scratchpad and read their `README`, `INSTALL` and core `SKILL.md` before using them (third-party code, so read it before running it).
- Findings:
  - **caveman**: terse chat output. Its own rules exempt docs, commits, code and memory, so it doesn't conflict with the process-documentation goal.
  - **ponytail**: the smallest complete change, with validation, error handling, security and tests never cut. It matches the brief's "partial but well-reasoned beats complete but undocumented".
  - Both are Claude Code plugins. The agent first thought only the user could install them through `/plugin` slash commands. This was corrected in prompt 003.
- The agent asked its first brainstorming question: *"Picture a reviewer going through your finished repo. What's the one thing you most want them to come away thinking about how you work with AI?"*

## Decisions

- D-002: Read third-party skills before installing them.

## Commit

`d0ff1bf` (shared with prompt 003)
