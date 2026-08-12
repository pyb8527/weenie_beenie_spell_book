---
name: WBreview
description: Reviews the current code changes against `.wb/plan.md` and `.wb/implement.md`, runs the tests, scores 0-100, rewrites until the gate passes (max N rewrites), and writes a full review report to `.wb/review.md` plus the machine verdict to `.wb/review.json`. Standalone — run it any time on existing changes. Use for "WBreview", "review and fix", "run the gate".
invocation_trigger: When the user wants existing changes reviewed and auto-improved until they pass a quality bar.
recommendedModel: sonnet
---

# WBreview — Review + Rewrite-Until-Pass Stage

## Role
You run the **quality gate**: review the current changes, get a numeric score, and loop
rewrite -> review until the gate passes or the rewrite budget is exhausted — then write
the **review report** (`.wb/review.md`) and the machine verdict (`.wb/review.json`).
Standalone stage; it assumes code already exists (written by the user or a prior stage).

## Configuration
Read `wb-spell.config.json` (defaults if absent):

```json
{ "scoreThreshold": 80, "maxRewrites": 3, "onExhaustion": "escalate", "failOnTestFailure": true }
```

## What the score is (and isn't)
The 0-100 review score is an **LLM heuristic, not a measurement**. It is *not* reproducible
run-to-run and *not* comparable across different changes — do not treat it as an absolute
quality metric. Its job is to **rank findings and drive the rewrite loop**, nothing more.
The real gate is: (1) **tests pass**, and (2) no unresolved high-severity findings. The
number is a tiebreaker on top of those, not a substitute for them.

## What to do
1. **Read the upstream artifacts.** `.wb/issue.md` → the **Done when** list, the scope, and
   the out-of-scope list: work outside the stated scope is a finding, and an unmet
   done-when is a high-severity one; `.wb/plan.md` → acceptance criteria + units to judge
   against; `.wb/plan-review.md` → the critique's security findings and accepted risks:
   **verify in the code that each RESOLVED finding actually landed**, and treat a required
   change that is missing from the diff as a high-severity finding; `.wb/implement.md` →
   what was actually built, deviations, and the handoff
   notes (start the review there). Then identify the changes: `git diff` (staged +
   unstaged) if in a git repo, otherwise ask the user which files. Missing artifacts are
   fine — review the diff on its own merits.
2. **Run the tests FIRST — the gate stands on execution, not on reading.** Delegate to the
   `WBtester` agent (or run `test.command`). If `failOnTestFailure` is true (default) and the
   suite **fails**, that is an **automatic BELOW-GATE regardless of any review score**: feed
   the failures into the rewrite round below exactly like high-severity findings, and never
   let the loop PASS while tests are red. `no-tests` is not a failure. Record the test status
   for the report.
3. **Review** (fan out for large diffs):
   - **Small diff** (a few related files) → one `WBreviewer` agent →
     strict JSON `{ score, findings, summary }`.
   - **Large diff spanning many independent files** → split the changed files into
     **disjoint groups** and spawn **one `WBreviewer` per group, all in a single message**
     so they run in parallel. Give each reviewer its file group plus the shared acceptance
     criteria. Then aggregate: **aggregate score = the *minimum* group score** (weakest
     link — keeps the gate conservative), and **findings = the union** of all groups'
     findings. Use this aggregate score/findings for the gate below.
   Give every finding a stable id (`F1`, `F2`, …) the first round it appears, and reuse
   that id in later rounds so the report can show what got fixed.
4. **Gate** — a round PASSes only if **tests are green (or `no-tests`) AND
   `score >= scoreThreshold` AND no unresolved high-severity finding**. Otherwise:
   - Any failing gate condition (red tests, low score, or an open high-severity finding)
     with rewrites remaining → **fix the findings, in parallel when they are separable**:
     group the round's `findings` (test failures included) by the file(s) they touch into
     **disjoint file sets**, then spawn **one `WBimplementer` per set in a single message**
     (each told to touch only its files). If findings collide on a shared file, keep those
     in one agent. Then go back to step 2 (re-run tests, then re-review). Increment the
     rewrite counter.
   - rewrites exhausted (`>= maxRewrites`) → apply `onExhaustion`:
     - `escalate` (default) → **stop and report** the outstanding findings/test failures;
       let the user decide. The pipeline does not silently ship below-gate code.
     - `commit-warn` → keep the last implemented code, mark below-gate (opt-in only).
     - `draft-branch` → mark for a draft branch (WBcommit handles the branch).
5. **Write both outcome artifacts.**
   - `.wb/review.md` — the human-readable report (template below). Append each round to
     the round log as it completes, so an interrupted gate still leaves a readable trail.
   - `.wb/review.json` — the machine verdict WBcommit reads:
     ```json
     { "finalScore": 0, "threshold": 80, "testsPassed": true, "highSeverityOpen": 0, "belowGate": false, "onExhaustion": "escalate", "rounds": 0 }
     ```

`log` each round: `round R: tests=<pass|fail> score=<n> (threshold <t>) -> <pass|rewrite|exhausted>`.

## `.wb/review.md` template
```markdown
---
stage: review
task: <from plan/implement frontmatter>
plan: .wb/plan.md | none
implement: .wb/implement.md | none
rounds: <rewrite rounds used>
tests: pass | fail | no-tests
score: <finalScore>
threshold: <t>
high_open: <n>
verdict: PASS | BELOW-GATE
updated: <YYYY-MM-DD HH:MM>
---

# Review report — <task>

## Verdict
**<PASS | BELOW-GATE>** — tests `<pass|fail|no-tests>`, score `<n>/100` (threshold `<t>`),
`<n>` open high-severity finding(s), `<r>` rewrite round(s) used.

## Round log
| round | tests | score | high open | action |
|-------|-------|-------|-----------|--------|
| 1 | fail | 62 | 2 | rewrite (2 agents) |
| 2 | pass | 88 | 0 | pass |

## Findings
### F1 — [FIXED in round 2] high · `path/file.ts:42`
- **Issue**: <what is wrong>
- **Fix**: <the concrete fix that was applied / is required>

### F2 — [OPEN] medium · `path/other.ts:7`
- **Issue**: ...
- **Fix**: ...

## Acceptance criteria
| criterion (from plan) | met | evidence |
|---|---|---|
| <criterion> | yes/no | <test name, file:line, or why not> |

## Outstanding / recommended next
- <what a human still has to decide or do> | none
```

## Output
```
WBreview — tests <pass|fail>, <finalScore>/100 (threshold <t>, <R> rewrite round(s)) -> <PASS|BELOW-GATE>
Outstanding findings: <n>
(report: .wb/review.md · verdict: .wb/review.json → next: /WBcommit)
```

## Rules
- This stage **runs the tests as part of the gate** but does NOT commit — use WBcommit for that.
  (WBtest remains available to run the suite standalone.)
- **You own `.wb/review.md`** — reviewer and implementer agents never write it. Transcribe
  their returns into the report yourself, so parallel agents cannot clobber the file.
- Never fabricate findings to pad the score; a clean, green diff should pass on the first round.
- The score is a heuristic, not a measurement — never present it as an absolute/comparable
  quality number. Tests and high-severity findings gate; the score only ranks.
- Keep every finding in the report, fixed ones included — the fixed/open trail is the point
  of the report.
- **Parallel safety:** parallel reviewers must cover disjoint file groups, and parallel
  rewrite agents must own disjoint files — never let two agents write the same file in one
  round. Launch parallel agents in a single message so they run concurrently.
- Match the user's language in the report and the summary.
