---
name: WBcommit
description: Stages the current changes and creates a commit summarizing the work, honoring any below-gate / draft-branch marker from WBreview, then records the commit in `.wb/commit.md`. Standalone stage of wb-spell. Use for "WBcommit", "commit this", "save changes".
invocation_trigger: When the user wants to commit the current changes.
recommendedModel: haiku
---

# WBcommit — Commit Stage

## Role
Create the commit for the current changes and close the cycle with a `.wb/commit.md`
record. Standalone — run it whenever the work is ready, whether or not the other stages
were used.

## What to do
1. **Read the upstream artifacts** for the commit message and the gate state:
   - `.wb/issue.md` → the title and problem, for the message subject and body. If it has a
     GitHub issue number, add a `Refs #<n>` line — use `Closes #<n>` only when the user
     asks, since that silently closes a public issue.
   - `.wb/plan.md` → the task, for the message subject.
   - `.wb/implement.md` → changed files and deviations, for the message body.
   - `.wb/review.json` → the verdict. If `belowGate` is true, plan to tag the commit with
     `[below-gate: score=<finalScore>/<threshold>]`. If `onExhaustion` is `draft-branch`,
     plan to commit onto `wb-spell/draft/<slug>`.
   - `.wb/review.md` → outstanding findings worth naming in the record.
   Any of these may be absent — fall back to the diff itself.
2. **Plugin version bump.** Read `commit.bumpPluginVersion` from `wb-spell.config.json`
   (default `"patch"`; `false` disables it). If it is not `false`, the repo root has a
   `.claude-plugin/plugin.json`, **and** the pending changes touch the plugin surface
   (`skills/`, `agents/`, `hooks/`, or `.claude-plugin/plugin.json`), pass a
   `bump-plugin-version: <level>` marker so the committer bumps `plugin.json`'s `version`
   by that semver level and includes it in the same commit. This is what lets a marketplace
   `update` actually re-pull the plugin — installs are keyed by version. Skip the bump for
   non-plugin repos or changes that don't touch the plugin surface.
3. Delegate to the `WBcommitter` agent with the task summary and the markers above.
4. It confirms the diff, (optionally) creates the draft branch, applies any version bump,
   stages the changed files, writes a concise message, and commits.
5. Write `.wb/commit.md` (template below) so the cycle's artifacts end with what shipped.
   `.wb/` is gitignored, so this record is local only — the next `/WBplan` archives it
   into `.wb/history/`.

## `.wb/commit.md` template
```markdown
---
stage: commit
task: <from plan frontmatter>
sha: <short sha>
branch: <branch>
below_gate: true | false
version_bump: <old> → <new> | none
committed: <YYYY-MM-DD HH:MM>
---

# Commit — <task>

## Commit
`<sha>` on `<branch>`
```
<commit message>
```

## Files committed
- `<path>` — created | modified

## Gate state at commit
- Tests: `<pass|fail|no-tests>` · Score: `<n>/<threshold>` · Verdict: `<PASS|BELOW-GATE>`
- Outstanding findings carried into this commit: <list, or none>

## Cycle artifacts
- `.wb/plan.md` · `.wb/implement.md` · `.wb/review.md` · `.wb/test.md`
```

## Output
```
WBcommit — committed <sha> on <branch>
  <first line of commit message>
(record: .wb/commit.md)
```

## Rules
- Only commit inside a git repo. If not a repo, report that and stop.
- Do not push unless the user asks.
- No AI-authorship trailers unless the project asks for them.
- If `.wb/review.json` says `belowGate` and `onExhaustion` is `escalate`, do not quietly
  commit — surface the verdict and let the user confirm.
- Match the user's language.
