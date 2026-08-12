---
name: WBplan
description: Writes a concrete implementation plan/spec for a coding task — files to touch, work units, parallelization decision, and acceptance criteria — into `.wb/plan.md`. Standalone stage of the wb-spell pipeline; run it on its own whenever you want a plan before coding. Use for "WBplan <task>", "plan this", "spec this out".
invocation_trigger: When the user wants a plan/spec for a task before implementing.
recommendedModel: sonnet
---

# WBplan — Plan / Spec Stage

## Role
Produce a short, concrete implementation plan for the given task and record it as
`.wb/plan.md`. This is the **first artifact of a cycle**: WBimplement executes it,
WBreview judges against it. This is also a standalone stage — the user may run only
this and stop.

## What to do
1. Take the task from, in order: the argument string → `.wb/issue.md` (its title, scope,
   done-when, and constraints are the spec; note its `id` for the plan frontmatter) → ask
   the user. When both an argument and an issue exist and they disagree, prefer the issue
   and say so.
2. **Start a clean cycle.** Compare the `task:` in any existing `.wb/*.md` artifacts with
   the task you are planning now:
   - **Different task** → move the whole previous cycle (`issue.md`, `run.md`, `research.md`,
     `plan.md`, `plan-review.md`, `implement.md`, `review.md`, `review.json`, `test.md`,
     `ship.md`) into `.wb/history/<YYYYMMDD-HHMMSS>-<slug-of-old-task>/`, so no downstream
     stage can read a stale artifact.
   - **Same task** (re-planning inside the current cycle, or `/WBspell` just wrote the issue)
     → keep them. Archiving here would throw away the issue and run log you are working from.
   Create `.wb/` if it does not exist.
3. **Establish the ground first.** Unless `wb-spell.config.json -> plan.research.mode` is
   `"off"`, invoke the **`WBresearch`** skill. It fans out parallel `WBscout` agents — one
   per lens (prior art, integration, conventions, risk, verification, history) — has
   `WBresearchjudge` verify every claim at the source, and writes the surviving facts to
   `.wb/research.md`. On `mode: "auto"` it decides a trivial task needs no fan-out and says
   so; that is a valid outcome, not a failure.
4. Delegate to the `WBplanner` agent with the task **and `.wb/research.md`**, which drafts
   the plan **including its work-unit breakdown and parallelization verdict**. Tell it to
   ground the plan in the accepted facts, treat `kind: inference` rows and
   `verified: false` rows as assumptions, and turn open questions into plan risks.
5. **Decide the execution mode** from the planner's units — this is the plan's job, not
   the implementer's:
   - `parallel` — **≥2 units that own disjoint files and have no ordering dependency**.
     Group them into waves; a unit goes in a later wave only if it depends on an earlier one.
   - `single` — one cohesive unit, or units that share files / must be ordered.
   Never mark two units parallel if they would write the same file.
6. Write `.wb/plan.md` using the template below (overwrite; you own this file).
7. **Red-team the plan.** Unless `wb-spell.config.json -> plan.critique` is `false`, invoke
   the **`WBcritique`** skill. It attacks the plan (security, blast radius, correctness,
   parallel-safety, testability), makes the planner revise it while blockers remain
   (`plan.maxReplans`, default 1), writes `.wb/plan-review.md`, and hands back a revised
   `.wb/plan.md`. A plan that ships with open blockers is escalated to you, not passed on.
8. Show the final plan to the user, with the critique verdict.

## `.wb/plan.md` template
```markdown
---
stage: plan
task: <one-line task>
issue: <issue id from .wb/issue.md> | none
created: <YYYY-MM-DD HH:MM>
mode: parallel | single
units: <n>
revision: 1                      # bumped by /WBcritique on each replan
research: .wb/research.md | none
critique: .wb/plan-review.md | none
critique_verdict: ACCEPT | REVISE | not-run
---

# Plan — <task>

## Approach
<1-3 sentences: the smallest correct approach.>

## Grounding
- **Rests on**: <fact ids from `.wb/research.md` this approach depends on> | none (no research)
- **Assumptions**: <inference/unverified rows relied on, and what breaks if wrong> | none
- **Open questions carried in**: <research questions still unanswered> | none

## Work units
### U1 — <title>
- **Owns**: `<path>`, `<path>`      # exact files this unit may write — no overlap with other units
- **Depends on**: none | U2
- **Do**: <what to change>
- **Done when**: <observable result>

### U2 — <title>
...

## Parallelization
- **Mode**: parallel | single
- **Why**: <e.g. "U1/U2/U3 touch disjoint files with no ordering dependency">
- **Wave 1**: U1, U2      # launched together, one agent each
- **Wave 2**: U3          # only after wave 1 (depends on U1)
- **Shared files**: <files >1 unit needs, and which unit owns them> | none

## Acceptance criteria
- [ ] <verifiable criterion>

## Risks / notes
- <anything the implementer or reviewer must know> | none
```

For a `single`-mode plan keep the same shape with one unit and `Wave 1: U1` — the
format stays stable so downstream stages parse it the same way.

## Output
```
## Plan — <task>  (revision <n>)
Mode: <parallel (N units, M waves) | single>
Critique: <ACCEPT | REVISE — n blocker(s) open | skipped>
Approach: ...
Files: ...
Acceptance criteria:
- [ ] ...

(saved to .wb/plan.md · critique: .wb/plan-review.md → next: /WBimplement)
```

## Rules
- Scale the plan to the task — a one-line fix gets one unit and a one-line plan.
- **File ownership is the contract.** Every unit lists the exact files it may write, and
  two units in the same wave must never list the same file. WBimplement enforces this.
- Do not write code here. This stage only plans.
- Do not invent files or APIs you have not verified exist.
- Match the user's language in both the plan and the summary.
