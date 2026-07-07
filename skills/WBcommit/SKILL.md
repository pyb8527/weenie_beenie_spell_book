---
name: WBcommit
description: Stages the current changes and creates a commit summarizing the work, honoring any below-gate / draft-branch marker from WBreview. Standalone stage of wb-spell. Use for "WBcommit", "commit this", "save changes".
invocation_trigger: When the user wants to commit the current changes.
recommendedModel: haiku
---

# WBcommit — Commit Stage

## Role
Create the commit for the current changes. Standalone — run it whenever the work is
ready, whether or not the other stages were used.

## What to do
1. If `.wb/review.json` exists, read it. If `belowGate` is true, plan to tag the commit
   with `[below-gate: score=<finalScore>/<threshold>]`. If `onExhaustion` is
   `draft-branch`, plan to commit onto `wb-spell/draft/<slug>`.
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

## Output
```
WBcommit — committed <sha> on <branch>
  <first line of commit message>
```

## Rules
- Only commit inside a git repo. If not a repo, report that and stop.
- Do not push unless the user asks.
- No AI-authorship trailers unless the project asks for them.
- Match the user's language.
