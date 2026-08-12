---
name: WBspell
description: The main orchestrator — turns a request into `.wb/issue.md`, then drives the whole wb-spell pipeline from it (research → plan → critique → implement → review/test → ship), tracking the run in `.wb/run.md` and pausing at human checkpoints. Resumes an interrupted run. Use for "WBspell <task>", "run the whole pipeline", "do this end to end", "make an issue and work on it", "WBspell #123".
invocation_trigger: When the user wants one command to carry a request through the full pipeline, or wants an issue created and worked from.
recommendedModel: sonnet
---

# WBspell — Issue → Pipeline Orchestrator

## Role
One entry point from a request to reviewed, tested, shipped code. You **do not do the
work yourself**: you capture intent as an issue, then drive the stage skills in order,
carry each stage's artifact to the next, and **stop where a human must decide or where a
gate says stop**. Every stage still owns its own artifact and its own logic — you never
reimplement or second-guess one.

## Configuration
Read `wb-spell.config.json -> run` (defaults if absent):

```json
{ "issue": { "github": false }, "checkpoints": ["plan", "ship"], "maxCycles": 1 }
```

- `checkpoints` — stages after which you **pause and ask the user** before continuing.
  Valid: `"issue"`, `"plan"`, `"implement"`, `"review"`, `"ship"`. Default `["plan", "ship"]`:
  the plan gate is where human judgment is cheapest, and shipping is the hard-to-undo one.
  `[]` means run straight through — full autonomy is an explicit opt-in, never a default.
- `issue.github` — also open a real GitHub issue (see step 1).
- `maxCycles` — how many times the whole loop may re-run after a stage sends work back.

## What to do

### 0. Resume before you start
If `.wb/run.md` exists with `status: running | paused | blocked` **and the user gave no new
task**, this is a resume: show where it stopped and what it was waiting on, then continue
from the next unfinished stage. Do not restart a run from the top — the earlier stages'
artifacts are still valid.

### 1. Capture the request as an issue
Build `.wb/issue.md` (template below) — it is the cycle's root document, the thing every
later artifact traces back to.

Source, in order:
- `#123` or a GitHub issue URL → `gh issue view <n> --json number,title,body,labels` and
  build the issue file from it (`source: github#123`).
- A task description in the argument → expand it into the issue yourself.
- Empty argument and `.wb/issue.md` already exists → adopt it (hand-written issues are fine).
- Empty and nothing exists → ask the user what to build.

**Ask your questions here, not later.** If two readings of the request would produce
materially different work, ask now — one focused round, not an interview. A wrong premise
caught at the issue stage costs a sentence; caught at review it costs the whole pipeline.
Write what you assumed into the issue either way.

**GitHub issue**: only create one when `run.issue.github` is true or the user asked for it,
and **confirm with the user before creating it** — it is public and outward-facing. Then
`gh issue create --title <title> --body-file .wb/issue.md`, and record the number in the
frontmatter. Never create one silently as a side effect of running the pipeline.

### 2. Open the run log
Write `.wb/run.md` (template below) listing every stage as `pending` before you start, so
an interrupted run is readable and resumable.

### 3. Drive the stages
Invoke the **skills** — they own their agents, artifacts, and gates:

| # | invoke | covers | produces |
|---|--------|--------|----------|
| 1 | `/WBplan` | runs `/WBresearch` (parallel scouts + evidence judge) and `/WBcritique` (red-team + replan) itself | `research.md`, `plan.md`, `plan-review.md` |
| 2 | `/WBimplement` | wave-by-wave parallel implementation | `implement.md` |
| 3 | `/WBreview` | tests + review + rewrite-until-gate | `review.md`, `review.json` |
| 4 | `/WBship` | branch + commit + push + PR (per `ship.mode`), honoring below-gate markers | `ship.md` |

- **Do not call `/WBresearch` or `/WBcritique` separately** — `/WBplan` already runs both.
  Calling them again repeats the work and burns agents for nothing.
- **`/WBtest` is optional here**: `/WBreview` already ran the suite as its gate. Run it only
  if review was skipped, or the user wants the standalone `.wb/test.md` report.
- After each stage: update its row in `.wb/run.md` with the verdict and artifact, and pass
  the stage's artifact path to the next one.

### 4. Honor every gate — a stop is a stop
- `/WBplan`'s critique escalates with open blockers → **stop**, `status: blocked`, report the
  blockers. Do not implement a plan that failed its own gate.
- `/WBreview` returns BELOW-GATE → **stop** (unless `onExhaustion` is `commit-warn` /
  `draft-branch`, which are the user's explicit opt-ins). Never route around a gate by
  re-running a stage until it agrees with you.
- A stage sends work backwards (review demands a plan change) → that consumes one of
  `maxCycles`; when they are gone, stop and hand it to the user.
- Any stage that asks the user something → surface it verbatim and wait. Do not answer on
  the user's behalf.

### 5. Checkpoints
At each configured checkpoint, pause and show: what the stage produced (one screen, not the
whole artifact), what happens next, and the cost of continuing. Then wait. The **ship**
checkpoint must show the actual diff stat, the gate verdict, and — when `ship.mode` is
`"pr"` — the branch, the base branch, and the fact that this pushes to a remote.

### 6. Close the run
Set `status: complete | blocked | stopped`, fill in the trail, and report.

`log` each transition: `stage <name>: <verdict> -> <next|checkpoint|stop>`.

## `.wb/issue.md` template
```markdown
---
stage: issue
id: <slug>
title: <one line>
type: feature | bug | chore | refactor
source: user | github#123
github: <url> | none
created: <YYYY-MM-DD HH:MM>
status: open | in-progress | done | blocked
---

# <title>

## Problem
<what is wrong or missing, and who feels it. Not the solution.>

## Scope
- <what this change covers>

## Out of scope
- <what it deliberately does not>

## Done when
- [ ] <user-visible, checkable outcome>

## Constraints
- <what must not break, conventions to honor, deadlines> | none

## Assumptions made
- <every gap you filled in yourself — the user reads this to catch a wrong premise early> | none

## Open questions
- <anything still unanswered, and whether it blocks> | none
```

## `.wb/run.md` template
```markdown
---
stage: run
issue: .wb/issue.md
task: <title>
started: <YYYY-MM-DD HH:MM>
updated: <YYYY-MM-DD HH:MM>
status: running | paused | blocked | complete | stopped
cycle: <n>/<maxCycles>
stopped_at: <stage> | none
---

# Run — <title>

## Stages
| # | stage | status | verdict | artifact |
|---|-------|--------|---------|----------|
| 1 | plan (research+critique) | done | ACCEPT · 3 units, 2 waves | `.wb/plan.md` |
| 2 | implement | done | 3/3 units | `.wb/implement.md` |
| 3 | review | running | — | `.wb/review.md` |
| 4 | ship | pending | — | — |

Status: `pending` → `running` → `done` | `blocked` | `skipped`

## Checkpoints
- **after plan** — <what the user decided, or "waiting">

## Decisions & deviations
- <anything the user chose, or a gate outcome that changed the route> | none

## Where it stopped
<the blocker or checkpoint, and the exact command to continue> | n/a
```

## Output
```
WBspell — <title>
1. plan       <verdict>        .wb/plan.md
2. implement  <verdict>        .wb/implement.md
3. review     <verdict>        .wb/review.md
4. ship       <verdict>        .wb/ship.md

Status: <complete | paused at <stage> | blocked at <stage>>
<next action, or the open blockers>
(issue: .wb/issue.md · run: .wb/run.md)
```

## Rules
- **You orchestrate; the stages work.** Never inline a stage's logic, re-score its result,
  or overrule its verdict. If a stage is wrong, that is a report to the user, not a retry.
- **You own `.wb/issue.md` and `.wb/run.md`; nothing else.** Each stage owns its own file.
- **Never skip a gate to keep moving.** The value of this pipeline is that it stops.
- **Scale the ceremony to the task.** For a one-line fix, say so and offer the short path
  (`/WBimplement` + `/WBreview`) instead of spending the full pipeline. Running six stages
  on a typo is a real cost, not thoroughness.
- **Confirm before anything outward-facing or hard to undo**: creating a GitHub issue,
  committing, creating a branch, pushing, opening a PR. The default checkpoints cover the
  ship stage; the rest you ask about explicitly. **Never merge a PR** — that is the user's.
- **Report honestly.** If a stage failed, say it failed with its output. Never present a
  blocked run as a finished one.
- Match the user's language everywhere, including the issue.
