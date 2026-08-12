---
name: WBreview
description: Reviews the current code changes, scores them 0-100, and rewrites until the score passes the gate (max N rewrites). The core quality gate of wb-spell. Standalone — run it any time on existing changes. Use for "WBreview", "review and fix", "run the gate".
invocation_trigger: When the user wants existing changes reviewed and auto-improved until they pass a quality bar.
recommendedModel: sonnet
---

# WBreview — Review + Rewrite-Until-Pass Stage

## Role
You run the **quality gate**: review the current changes, get a numeric score, and loop
rewrite -> review until the score passes or the rewrite budget is exhausted. This is a
standalone stage; it assumes code already exists (written by the user or a prior stage).

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
1. Identify the changes to review: `git diff` (staged + unstaged) if in a git repo,
   otherwise ask the user which files. If `.wb/plan.md` exists, load its acceptance
   criteria to judge against.
2. **Run the tests FIRST — the gate stands on execution, not on reading.** Delegate to the
   `WBtester` agent (or run `test.command`). If `failOnTestFailure` is true (default) and the
   suite **fails**, that is an **automatic BELOW-GATE regardless of any review score**: feed
   the failures into the rewrite round below exactly like high-severity findings, and never
   let the loop PASS while tests are red. `no-tests` is not a failure. Record the test status
   for `.wb/review.json`.
3. **Review** (fan out for large diffs):
   - **Small diff** (a few related files) → one `WBreviewer` agent →
     strict JSON `{ score, findings, summary }`.
   - **Large diff spanning many independent files** → split the changed files into
     **disjoint groups** and spawn **one `WBreviewer` per group, all in a single message**
     so they run in parallel. Give each reviewer its file group plus the shared acceptance
     criteria. Then aggregate: **aggregate score = the *minimum* group score** (weakest
     link — keeps the gate conservative), and **findings = the union** of all groups'
     findings. Use this aggregate score/findings for the gate below.
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
5. Write the outcome to `.wb/review.json` so WBcommit can tag the commit:
   ```json
   { "finalScore": 0, "threshold": 80, "testsPassed": true, "highSeverityOpen": 0, "belowGate": false, "onExhaustion": "escalate", "rounds": 0 }
   ```

`log` each round: `round R: tests=<pass|fail> score=<n> (threshold <t>) -> <pass|rewrite|exhausted>`.

## Output
```
WBreview — tests <pass|fail>, <finalScore>/100 (threshold <t>, <R> rewrite round(s)) -> <PASS|BELOW-GATE>
Outstanding findings: <n>   (saved to .wb/review.json)
```

## Rules
- This stage **runs the tests as part of the gate** but does NOT commit — use WBcommit for that.
  (WBtest remains available to run the suite standalone.)
- Never fabricate findings to pad the score; a clean, green diff should pass on the first round.
- The score is a heuristic, not a measurement — never present it as an absolute/comparable
  quality number. Tests and high-severity findings gate; the score only ranks.
- **Parallel safety:** parallel reviewers must cover disjoint file groups, and parallel
  rewrite agents must own disjoint files — never let two agents write the same file in one
  round. Launch parallel agents in a single message so they run concurrently.
- Match the user's language in the summary.
