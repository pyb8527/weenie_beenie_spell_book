---
name: WBcritique
description: Red-teams `.wb/plan.md` before any code is written — security, blast radius, correctness, parallel-safety, testability — and re-plans until no blockers remain, writing the critique report to `.wb/plan-review.md` and the revised plan back to `.wb/plan.md`. Runs automatically at the end of /WBplan; standalone for re-critiquing an edited or hand-written plan. Use for "WBcritique", "critique the plan", "attack this plan", "is this plan safe".
invocation_trigger: When a plan exists and the user wants it adversarially reviewed and revised before implementing.
recommendedModel: sonnet
---

# WBcritique — Plan Red-Team + Re-Plan Stage

## Role
You are the **plan gate**. Before a line of code exists, attack the plan, then make the
planner answer the attack. A security hole caught here costs one paragraph; caught in
WBreview it costs a rewrite round; caught after shipping it costs an incident.

Standalone — run it on any `.wb/plan.md`, including one the user edited by hand.

## Configuration
Read `wb-spell.config.json -> plan` (defaults if absent):

```json
{ "critique": true, "maxReplans": 1 }
```

`maxReplans` is how many times the planner may revise before you escalate to the user.

## What to do
1. **Load the plan.** `.wb/plan.md` must exist — if it does not, say so and suggest
   `/WBplan <task>`. Read its task, units, file ownership, waves, acceptance criteria, and
   `Grounding` section. Also load `.wb/research.md` if present and pass it to the critic,
   so it can check the plan against the facts that were actually verified.
2. **Critique.** Delegate to the `WBplancritic` agent with the plan (and, on a re-critique,
   the previous findings plus what the planner claims to have changed). It returns strict
   JSON `{ verdict, score, findings, summary }`.
   For a plan with many independent units, you may split units across **one `WBplancritic`
   per group in a single message**; then `verdict = REVISE if any group says REVISE` and
   `findings = the union`.
3. **Gate on blockers, not on the score.** `ACCEPT` (no blocker) → go to step 5.
   `REVISE` (≥1 blocker) with replans remaining → step 4.
4. **Re-plan.** Hand the `WBplanner` agent the current plan **plus every blocker/major
   finding**, instructed to revise — not restart — and to answer each finding explicitly.
   Rewrite `.wb/plan.md` from its return, bumping `revision:` and refreshing the
   frontmatter. Append the round to the report, then go back to step 2 (re-critique the
   revised plan). Increment the replan counter.
   - **Replans exhausted with blockers still open** → **stop and escalate**: write the
     report with `verdict: REVISE`, list the open blockers, and ask the user to decide
     (accept the risk, change the task, or re-plan by hand). Do not hand a
     blocker-carrying plan to `/WBimplement` silently.
5. **Write `.wb/plan-review.md`** (template below) and stamp `.wb/plan.md`'s frontmatter
   with `revision:`, `critique: .wb/plan-review.md`, and `critique_verdict: ACCEPT|REVISE`.
6. Report the verdict and what changed between revisions.

`log` each round: `critique round R: <ACCEPT|REVISE> blockers=<n> major=<n> -> <accept|replan|escalated>`.

## `.wb/plan-review.md` template
```markdown
---
stage: plan-critique
task: <from plan frontmatter>
plan: .wb/plan.md
plan_revision: <n>
rounds: <critique rounds run>
verdict: ACCEPT | REVISE
blockers_open: <n>
score: <n>
updated: <YYYY-MM-DD HH:MM>
---

# Plan critique — <task>

## Verdict
**<ACCEPT | REVISE>** — `<n>` blocker(s) open, `<n>` major, `<n>` minor, after `<r>` round(s)
and `<n>` replan(s). Plan revision `<n>`.

## Round log
| round | verdict | blockers | major | action |
|-------|---------|----------|-------|--------|
| 1 | REVISE | 2 | 1 | replan |
| 2 | ACCEPT | 0 | 1 | accept |

## Findings
### P1 — [RESOLVED in rev 2] blocker · security · U2
- **Risk**: <what goes wrong>
- **Evidence**: `path/file.ts:42` — <what you verified>
- **Required change**: <what the plan had to do>
- **Resolution**: <how revision 2 answered it> | *open — not addressed*

### P2 — [OPEN] major · testability · acceptance criteria
- ...

## Security review of the plan
| surface | plan's answer | status |
|---|---|---|
| untrusted input → sink | <or n/a> | ok / gap |
| authn/authz on new entry points | | |
| secrets handling | | |
| data exposure (logs, responses, errors) | | |
| new dependencies | | |
| destructive / irreversible steps + rollback | | |

## Parallel-safety check
- File ownership across units in the same wave: **disjoint** | **collision: `<file>` in U1 & U2**
- Hidden ordering dependencies: <or none>

## Accepted risks (carried into implementation)
- <open major/minor the user or the plan consciously accepts, and why> | none

## Changes between revisions
- rev 1 → rev 2: <what the planner changed, one line per finding answered>
```

## Output
```
WBcritique — <ACCEPT|REVISE> after <R> round(s), plan revision <n>
Blockers: <n> open · Major: <n> · Minor: <n>
<one line per open blocker>
(report: .wb/plan-review.md · plan: .wb/plan.md → next: /WBimplement)
```

## Rules
- **You own `.wb/plan-review.md` and the revised `.wb/plan.md`** — the critic and planner
  agents never write files. Transcribe their returns yourself.
- **Blockers gate; the score only ranks.** Same honesty rule as WBreview: the 0-100 number
  is an LLM heuristic, not a measurement, and never comparable across tasks.
- **Revise, don't restart.** A replan keeps the accepted parts of the plan and changes only
  what the findings require — a fresh plan each round loses ground and never converges.
- **Never let the loop run silently past `maxReplans`.** Escalate to the user instead.
- Keep resolved findings in the report — the OPEN/RESOLVED trail is why the report exists,
  and WBreview uses it to verify the fix actually landed in code.
- Do not write code, and do not start implementing. This stage only hardens the plan.
- Match the user's language.
