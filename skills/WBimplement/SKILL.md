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
2. Delegate to the `WBimplementer` agent, handing it the plan (or task) as the spec.
   This is a first-pass implementation, so pass **no** reviewer findings.
3. Show the agent's summary of what it created/modified.

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
- Do NOT review, run tests, or commit here — hand off to /WBreview next.
- If `.wb/plan.md` and the argument disagree, prefer the plan and note the discrepancy.
- Match the user's language in the summary.
