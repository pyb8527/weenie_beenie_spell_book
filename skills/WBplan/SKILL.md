---
name: WBplan
description: Writes a concrete implementation plan/spec for a coding task — files to touch, approach, and acceptance criteria. Standalone stage of the wb-spell pipeline; run it on its own whenever you want a plan before coding. Use for "WBplan <task>", "plan this", "spec this out".
invocation_trigger: When the user wants a plan/spec for a task before implementing.
recommendedModel: sonnet
---

# WBplan — Plan / Spec Stage

## Role
Produce a short, concrete implementation plan for the given task. This is a standalone
stage — the user may run only this and stop, or feed the plan into implementation later.

## What to do
1. Take the task description from the argument string. If empty, ask the user for it.
2. Delegate to the `WBplanner` agent, which skims the relevant files and drafts the plan.
3. Show the plan to the user.
4. Save it to `.wb/plan.md` so later stages (WBreview) can read the acceptance criteria.
   Overwrite any existing `.wb/plan.md`.

## Output
Print the plan and confirm where it was saved:

```
## Plan — <task>
Approach: ...
Files: ...
Acceptance criteria:
- [ ] ...

(saved to .wb/plan.md)
```

## Rules
- Scale the plan to the task — a one-line fix gets a one-line plan.
- Do not write code here. This stage only plans.
- Match the user's language.
