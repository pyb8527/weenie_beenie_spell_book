---
name: WBresearch
description: Researches a task with parallel WBscout agents that each look through a different lens (prior art, integration, conventions, risk, verification, history), then has WBresearchjudge verify every claim at the source and keep only what is true — writing the grounded brief to `.wb/research.md`. Runs automatically at the start of /WBplan; standalone for exploring a task before planning. Use for "WBresearch <task>", "research this", "scout the codebase before planning".
invocation_trigger: When a task needs the codebase understood from several angles before a plan is written.
recommendedModel: sonnet
---

# WBresearch — Multi-Lens Research + Evidence Gate

## Role
Feed the planner **verified facts instead of one agent's impression.** Several scouts read
the repo through different lenses in parallel, then a judge verifies every claim at the
source and throws out what does not hold up. Only what survives reaches `.wb/research.md`.

Standalone — run it on any task to understand the ground before planning.

## Configuration
Read `wb-spell.config.json -> plan.research` (defaults if absent):

```json
{ "mode": "auto", "maxScouts": 4 }
```

- `mode: "auto"` — research only when it would change the plan (see step 1). `"always"` —
  always fan out. `"off"` — skip; the planner reads the repo itself.
- `maxScouts` — how many lenses run in parallel.

## What to do
0. **Take the task** from the argument string, or from `.wb/issue.md` if it exists — its
   problem statement, scope, and out-of-scope lines tell you what is worth researching and
   what is not. Its **open questions** are research targets; answer what the code can answer.
1. **Decide whether to research at all** (`mode: "auto"`). Skip the fan-out — say so and
   stop — when the task is a **small change in code the session already understands**:
   a one-line fix, a rename, a copy tweak, a file you just read. Fan out when any of these
   holds: unfamiliar or legacy code, ≥2 subsystems touched, an auth/data/migration surface,
   an existing implementation may already cover it, or the user asked for research.
   Research on a trivial task costs more than it returns — that is a real cost, not caution.
2. **Pick the lenses** (up to `maxScouts`) from `WBscout`'s table — `prior-art`,
   `integration`, `conventions`, `risk`, `verification`, `history` — choosing by the task:
   - touching auth / user data / destructive ops → `risk` is mandatory
   - "add X to existing Y" → `prior-art` + `integration`
   - new subsystem in an unfamiliar repo → `conventions` + `integration`
   - "why is this broken / why is it like this" → `history` + `verification`
   Each lens must have a real question for *this* task. Do not fill the quota with a lens
   that has nothing to look for.
3. **Fan out.** Spawn **one `WBscout` per lens, all in a single message** so they run
   concurrently. Give each: the task, its lens name + id prefix, and any context the user
   provided. Scouts are read-only and never write files.
4. **Judge.** Hand every scout's JSON to the `WBresearchjudge` agent. It opens the cited
   evidence, merges duplicate claims across lenses, resolves or flags contradictions, drops
   what it cannot verify or what is irrelevant, and returns `accepted` / `rejected` /
   `conflicts` / `openQuestions` / `coverageGaps`.
5. **Fill a real gap once.** If `coverageGaps` names something the plan genuinely needs,
   you may run **one** more round of scouts on those gaps, then re-judge. Stop there —
   research loops that chase completeness never terminate.
6. **Write `.wb/research.md`** (template below). Keep the rejected list — it is what stops
   the same wrong claim from being "discovered" again next round.
7. Report what the research established and what remains unknown.

`log` the fan-out: `research: <n> lenses -> <n> findings -> <n> accepted, <n> rejected, <n> open`.

## `.wb/research.md` template
```markdown
---
stage: research
task: <one-line task>
issue: <issue id from .wb/issue.md> | none
lenses: [prior-art, integration, risk]
scouts: <n>
findings_raw: <n>
accepted: <n>
rejected: <n>
open_questions: <n>
created: <YYYY-MM-DD HH:MM>
---

# Research — <task>

## What this establishes
<2-4 sentences: the ground truth a plan can stand on.>

## Accepted facts
| id | claim | evidence | lens(es) | kind | confidence |
|----|-------|----------|----------|------|------------|
| CONV1 | <claim> | `path/file.ts:42-58` | conventions, integration | fact | high |

> `kind: inference` rows are conclusions, not observations — the plan must not treat them
> as established.

## Rejected claims
| id | claim | why it was dropped |
|----|-------|--------------------|
| PRIOR3 | <claim> | cited location does not exist |

## Conflicts between lenses
- **INTEG2 vs CONV4** — <what they disagreed about> → **resolved**: <what the code shows> | **open**

## Open questions
- <what is still unknown, and what would answer it>

## Implications for the plan
- <fact id> → <what the plan must do because of it>

## Not researched
- <lens or area deliberately skipped, and why>
```

## Output
```
WBresearch — <n> lenses in parallel → <accepted> facts kept, <rejected> dropped, <open> open question(s)
Key: <one line per top implication>
(brief: .wb/research.md → next: /WBplan)
```

## Rules
- **You own `.wb/research.md`** — scouts and the judge never write files. They return JSON;
  you transcribe it. Parallel agents writing one file clobber each other.
- **Nothing enters the brief unverified.** An unverified claim is either marked
  `verified: false` as an explicit assumption or it is rejected. Never launder an
  inference into a fact — a wrong "fact" here poisons the plan, the code, and the review.
- **Lenses must be disjoint questions.** Overlapping lenses return the same findings and
  waste the fan-out; the point of parallelism here is *different* angles, not more of one.
- **Scale to the task.** No fan-out for trivial work. Two sharp lenses beat six vague ones.
- Launch every scout in a **single message** so they run concurrently, not sequentially.
- Do not plan or write code here — this stage only establishes what is true.
- Match the user's language.
