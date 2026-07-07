---
name: WBimplement
description: Turns a plan (or a task description) into working code by delegating to the WBimplementer agent. The plan → code stage of wb-spell. Standalone — run it any time. Use for "WBimplement <task>", "implement the plan", "build this".
invocation_trigger: When the user wants a plan (or a described task) turned into actual code before reviewing.
recommendedModel: sonnet
---

# WBimplement — Plan → Code Stage

## Role
Turn a plan into working code. This is a standalone stage — it can run right after
`/WBplan`, or on its own from just a task description. It writes code; it does not
review, test, or commit (those are WBreview / WBtest / WBcommit).

## What to do
1. Determine the work to implement, in this order of preference:
   - `.wb/plan.md` exists → use its approach and acceptance criteria as the spec.
   - Otherwise → use the argument string as the task description.
   - Both empty → ask the user what to implement.
2. **Split the work into independent units, then fan out.** Break the plan/task into
   the largest set of units that touch **disjoint files** and have no ordering
   dependency between them (e.g. separate modules, separate doc pages/sections,
   independent components, unrelated fixes).
   - **≥2 independent units** → spawn **one `WBimplementer` agent per unit, all in a
     single message** so they run in parallel. Give each agent (a) the shared plan/task
     as context, (b) its own scoped slice, and (c) the **exact file(s) it owns** with an
     instruction to touch *only* those files. This is a first-pass implementation, so
     pass **no** reviewer findings.
   - **1 cohesive unit** (or units that share/depend on the same files) → spawn a single
     `WBimplementer` agent, as before. Do NOT force a split that would make two agents
     edit the same file — that corrupts writes.
3. Collect every agent's summary and merge them into one combined file list.

## Output
```
## Implemented — <task>
Files:
- <path> — created|modified — <one-line what>

Notes: <anything WBreview/WBtest should know, or "none">

Next: /WBreview
```

## Rules
- Scale the work to the task — do not gold-plate beyond the plan.
- **Parallelize by default when the work is separable.** Prefer several small, focused
  WBimplementer agents over one big one whenever the units touch disjoint files.
- **Never let two parallel agents write the same file.** Partition file ownership up
  front; if a file is shared by multiple units, keep those units in one agent (or run
  them sequentially).
- Launch all parallel agents in a **single message** (multiple tool calls) so they
  actually run concurrently, not one after another.
- Do NOT review, run tests, or commit here — hand off to /WBreview next.
- If `.wb/plan.md` and the argument disagree, prefer the plan and note the discrepancy.
- Match the user's language in the summary.
