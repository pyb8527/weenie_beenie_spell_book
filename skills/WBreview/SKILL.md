---
name: WBreview
description: Reviews the current code changes, scores them 0-100, and rewrites until the score passes the gate (max N rewrites). The core quality gate of weenie-beenie. Standalone — run it any time on existing changes. Use for "WBreview", "review and fix", "run the gate".
invocation_trigger: When the user wants existing changes reviewed and auto-improved until they pass a quality bar.
recommendedModel: sonnet
---

# WBreview — Review + Rewrite-Until-Pass Stage

## Role
You run the **quality gate**: review the current changes, get a numeric score, and loop
rewrite -> review until the score passes or the rewrite budget is exhausted. This is a
standalone stage; it assumes code already exists (written by the user or a prior stage).

## Configuration
Read `weenie-beenie.config.json` (defaults if absent):

```json
{ "scoreThreshold": 80, "maxRewrites": 3, "onExhaustion": "commit-warn" }
```

## What to do
1. Identify the changes to review: `git diff` (staged + unstaged) if in a git repo,
   otherwise ask the user which files. If `.wb/plan.md` exists, load its acceptance
   criteria to judge against.
2. **Review**: delegate to the `WBreviewer` agent → strict JSON `{ score, findings, summary }`.
3. **Gate**:
   - `score >= scoreThreshold` → PASS. Stop the loop.
   - `score < scoreThreshold` and rewrites remaining → delegate to the `WBimplementer`
     agent with this round's `findings`, then go back to step 2 (re-review). Increment
     the rewrite counter.
   - rewrites exhausted (`>= maxRewrites`) → apply `onExhaustion`:
     - `commit-warn` (default) → **keep the last implemented code**, mark below-gate.
     - `escalate` → stop and report findings; let the user decide.
     - `draft-branch` → mark for a draft branch (WBcommit handles the branch).
4. Write the outcome to `.wb/review.json` so WBcommit can tag the commit:
   ```json
   { "finalScore": 0, "threshold": 80, "belowGate": false, "onExhaustion": "commit-warn", "rounds": 0 }
   ```

`log` each round: `round R: score=<n> (threshold <t>) -> <pass|rewrite|exhausted>`.

## Output
```
WBreview — <finalScore>/100 (threshold <t>, <R> rewrite round(s)) -> <PASS|BELOW-GATE>
Outstanding findings: <n>   (saved to .wb/review.json)
```

## Rules
- This stage does NOT run tests and does NOT commit — use WBtest / WBcommit for those.
- Never fabricate findings to pad the score; a clean diff should pass on the first round.
- Match the user's language in the summary.
