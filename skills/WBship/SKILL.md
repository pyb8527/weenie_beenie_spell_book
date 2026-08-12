---
name: WBship
description: Delivers the finished work — branch, commit, push, and open a pull request whose body is written from the `.wb/` artifacts — honoring any below-gate marker from WBreview, and never merging. Formerly WBcommit; `mode: "commit"` is still the plain-commit behavior. Standalone stage of wb-spell. Use for "WBship", "WBcommit", "commit this", "open a PR", "save changes", "ship it".
invocation_trigger: When the user wants the current changes committed, or branched/pushed/turned into a pull request.
recommendedModel: haiku
---

# WBship — Delivery Stage

## Role
Get the finished work out: branch → commit → push → PR, as far as the configured mode
goes. Close the cycle with a `.wb/ship.md` record. Standalone — run it whenever the work
is ready, whether or not the other stages were used. **Merging is never yours.**

## Configuration
Read `wb-spell.config.json -> ship` (falling back to the legacy `commit` block, then defaults):

```json
{ "mode": "pr", "branchPrefix": "wb/", "base": null, "draft": false, "bumpPluginVersion": "patch" }
```

- `mode` — how far to go:
  - `"commit"` — commit on the current branch. Nothing leaves the machine.
  - `"branch"` — create the work branch, then commit.
  - `"pr"` (default) — branch, commit, push, open a PR.
- `base` — target branch; `null` auto-detects the remote's default branch.
- **Degrade, don't fail**: on `"pr"` with no remote, a non-GitHub remote, or no working `gh`,
  fall back to `"branch"` (or `"commit"`) and say so plainly in the output.

## What to do
1. **Read the upstream artifacts** — they are the commit message and the PR body:
   - `.wb/issue.md` → title, problem, scope, **Done when**. If it carries a GitHub issue
     number, add `Refs #<n>`; use `Closes #<n>` only when the user asks, since that closes
     a public issue on merge.
   - `.wb/plan.md` → the approach and units, for the body's "what changed".
   - `.wb/review.md` / `.wb/review.json` → the verdict. `belowGate: true` → tag the commit
     `[below-gate: score=<finalScore>/<threshold>]` **and** mark the PR `--draft`: below-gate
     work never goes out looking like it passed. Also carry the outstanding findings into
     the body.
   - `.wb/test.md` → the test status line.
   Any of these may be absent — fall back to the diff itself.
2. **Plugin version bump.** Read `ship.bumpPluginVersion` (default `"patch"`; `false` disables).
   If it is not `false`, the repo root has a `.claude-plugin/plugin.json`, **and** the pending
   changes touch the plugin surface (`skills/`, `agents/`, `hooks/`, or
   `.claude-plugin/plugin.json`), pass a `bump-plugin-version: <level>` marker so the shipper
   bumps `plugin.json`'s `version` and includes it in the same commit. This is what lets a
   marketplace `update` actually re-pull the plugin — installs are keyed by version. Skip it
   for non-plugin repos or changes that don't touch the plugin surface.
3. **Pick the branch** (`mode: branch | pr`). Already on a non-base branch → use it. On the
   base branch → `<branchPrefix><slug-of-issue-or-task>`.
4. **Confirm before anything leaves the machine.** For `mode: "pr"`, show the user the diff
   stat, the branch, the base, the gate verdict, and the PR title — then wait for approval.
   Pushing and opening a PR are public and hard to walk back; a pipeline stage is not
   standing permission. (`mode: "commit"` needs no confirmation.)
5. **Write the PR body** to `.wb/pr-body.md` (template below), then delegate to the
   `WBshipper` agent with the mode, markers, branch, base, and `pr-body-file`.
6. The agent branches, applies any version bump, stages the explicit paths, commits, pushes,
   and opens the PR. It never merges.
7. Write `.wb/ship.md` (template below). `.wb/` is gitignored, so this record is local only —
   the next `/WBplan` archives it into `.wb/history/`.

## `.wb/pr-body.md` template
```markdown
> **Gate: BELOW-GATE — opened as a draft.** tests `<status>`, score `<n>/<t>`,
> `<n>` open high-severity finding(s). Do not merge until these are resolved.
<!-- omit the block above entirely when the gate passed -->

## What & why
<the issue's problem in 2-3 sentences, then the approach from the plan>

## Changes
- `<path>` — <one line>

## Verification
- Tests: `<pass|fail|no-tests>` — `<command>`, `<n>` passed / `<n>` failed
- Review: `<n>/100` (threshold `<t>`), `<r>` rewrite round(s), `<n>` open finding(s)
- Done when:
  - [x] <criterion from the issue> — <evidence>

## Risks / follow-ups
- <accepted risks from the plan critique, outstanding findings, what a reviewer should
  look at hardest> | none

Refs #<n>
```

## `.wb/ship.md` template
```markdown
---
stage: ship
task: <from issue/plan frontmatter>
mode: commit | branch | pr
sha: <short sha>
branch: <branch>
base: <base branch>
pushed: true | false
pr: <url> | none
draft: true | false
below_gate: true | false
version_bump: <old> → <new> | none
shipped: <YYYY-MM-DD HH:MM>
---

# Shipped — <task>

## Commit
`<sha>` on `<branch>` (base `<base>`)
```
<commit message>
```

## Pull request
<url> — <draft | ready> | none (<why: mode, no remote, no gh>)

## Files
- `<path>` — created | modified

## Gate state at ship time
- Tests: `<pass|fail|no-tests>` · Score: `<n>/<threshold>` · Verdict: `<PASS|BELOW-GATE>`
- Outstanding findings shipped with this change: <list, or none>

## Cycle artifacts
- `.wb/issue.md` · `.wb/plan.md` · `.wb/plan-review.md` · `.wb/implement.md` · `.wb/review.md` · `.wb/test.md`
```

## Output
```
WBship — <mode>: committed <sha> on <branch>
  <first line of commit message>
  Pushed: <yes|no (reason)>   PR: <url|draft url|none (reason)>
(record: .wb/ship.md)
```

## Rules
- Only work inside a git repo. If not a repo, report that and stop.
- **Never merge, never force-push, never push the base branch directly.** The user merges.
- **Confirm before push / PR / branch creation on a shared repo.** Approval for one push is
  not approval for the next.
- If `.wb/review.json` says `belowGate` and `onExhaustion` is `escalate`, do not quietly
  ship — surface the verdict and let the user confirm. If they do, the PR goes out as a
  **draft** with the gate banner.
- Report the real outcome: if the PR could not be opened, say so and how far it got. Never
  describe a degraded run as a finished one.
- No AI-authorship trailers unless the project asks for them.
- Match the user's language.
