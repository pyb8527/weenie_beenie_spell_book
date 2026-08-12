---
name: WBimplement
description: Turns `.wb/plan.md` (or a task description) into working code by delegating to WBimplementer agents, running the plan's units in parallel when it says so, and tracking every unit's progress in a single `.wb/implement.md` board. Standalone — run it any time. Use for "WBimplement <task>", "implement the plan", "build this".
invocation_trigger: When the user wants a plan (or a described task) turned into actual code before reviewing.
recommendedModel: sonnet
---

# WBimplement — Plan → Code Stage

## Role
Turn the plan into working code and **keep one progress board** — `.wb/implement.md` —
that reflects the state of every work unit, including units running in parallel. This
stage writes code; it does not review, test, or commit (those are WBreview / WBtest /
WBcommit).

## What to do
1. **Read the upstream artifact.** In this order of preference:
   - `.wb/plan.md` exists → it is the spec. Take its **work units**, each unit's
     **owned files**, the **Parallelization** section (mode + waves), and the
     **acceptance criteria**. Check the frontmatter `task:` still matches what the user
     is asking for; if it does not, say so and ask before proceeding on a stale plan.
     If the frontmatter says `critique_verdict: REVISE`, the plan still carries open
     blockers — surface them and confirm with the user before implementing.
   - `.wb/plan-review.md` exists → read its **Accepted risks** and any OPEN finding. Pass
     the ones touching a unit to that unit's agent as constraints ("this handler must
     check ownership before returning the row"), so the plan's hardening survives into code.
   - No plan → derive units yourself from the argument string, applying the same rule
     (≥2 units with disjoint files and no dependency → parallel).
   - Both empty → ask the user what to implement.
2. **Open the board.** Write `.wb/implement.md` (template below) with every unit listed
   as `pending` *before* launching anything, so an interrupted run leaves a readable state.
3. **Execute wave by wave.** For each wave in the plan:
   - Mark that wave's units `running` in the board.
   - Spawn **one `WBimplementer` agent per unit, all in a single message** so they truly
     run concurrently. Give each agent: (a) the plan's approach as shared context,
     (b) its unit id + scoped slice, (c) the **exact files it owns**, with an instruction
     to touch *only* those files, and (d) the relevant acceptance criteria.
     A single-unit wave is just one agent — same flow.
   - This is a first-pass implementation, so pass **no** reviewer findings.
   - When the wave returns, update each unit's row to `done` / `failed` with its note,
     append its files to **Changed files**, and refresh `updated:`.
   - If a unit failed, do not start a dependent wave — mark the dependents `blocked`,
     set `status: blocked`, and report.
4. **Close the board**: set `status: complete`, fill in **Deviations from plan** and
   **Handoff to review**, then print the summary.

## `.wb/implement.md` template
```markdown
---
stage: implement
task: <from plan frontmatter, or the argument>
plan: .wb/plan.md | none
mode: parallel | single
agents: <total WBimplementer agents spawned>
started: <YYYY-MM-DD HH:MM>
updated: <YYYY-MM-DD HH:MM>
status: running | complete | blocked
---

# Implementation — <task>

## Progress
| unit | wave | scope | files owned | status | note |
|------|------|-------|-------------|--------|------|
| U1 | 1 | <one line> | `a.ts` | done | |
| U2 | 1 | <one line> | `b.ts` | running | |
| U3 | 2 | <one line> | `c.ts` | pending | waits on U1 |

Status values: `pending` → `running` → `done` | `failed` | `blocked` | `skipped`

## Changed files
- `<path>` — created | modified — <one-line what> (U1)

## Deviations from plan
- <what differed and why> | none

## Handoff to review
- <what WBreview/WBtest should look at first, unverified assumptions, follow-ups> | none
```

## Output
```
## Implemented — <task>
Mode: <parallel: N agents across M waves | single>
Units: <done>/<total> done<, X failed>
Files:
- <path> — created|modified — <one-line what>

Notes: <anything WBreview/WBtest should know, or "none">

(board: .wb/implement.md → next: /WBreview)
```

## Rules
- **The board is single-writer: only this skill writes `.wb/implement.md`.** Parallel
  WBimplementer agents must never write it — concurrent writes to one file clobber each
  other. Agents return their summary; you transcribe it.
- **Never let two parallel agents write the same source file.** The plan's file ownership
  is the partition. If the plan marks units parallel but they actually share a file, drop
  them into one agent (or sequential waves) and record it under **Deviations from plan**.
- Launch each wave's agents in a **single message** (multiple tool calls) so they run
  concurrently, not one after another.
- Scale the work to the task — do not gold-plate beyond the plan.
- Do NOT review, run tests, or commit here — hand off to /WBreview next.
- If `.wb/plan.md` and the argument disagree, prefer the plan, note the discrepancy in
  **Deviations from plan**, and say so in the summary.
- Match the user's language in the board and the summary.
