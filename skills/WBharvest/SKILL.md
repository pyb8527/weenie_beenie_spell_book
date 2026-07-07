---
name: WBharvest
description: Given a GitHub repo URL, clones it, scores every skill it finds 0-100 with the WBharvester agent, and imports only the ones that pass the gate (default 80) — rewriting each into your WB* skill format. Use for "WBharvest <github-url>", "import skills from <repo>", "steal the good skills from this repo".
invocation_trigger: When the user gives a GitHub URL and wants its skills evaluated, filtered by a quality score, and adopted as WB* skills.
recommendedModel: sonnet
---

# WBharvest — Import + Quality-Gate External Skills

## Role
Turn a public skills repo into **your** skills. You clone the repo, discover every skill
in it, have the `WBharvester` agent score each one 0-100, and import only those at or above
the gate — rewritten into this project's `WB*` skill format under `skills/`. Lower-scoring
or unsafe skills are rejected and never written.

## Configuration
Read `wb-spell.config.json` (defaults if absent):

```json
{ "scoreThreshold": 80, "harvest": { "scoreThreshold": 80, "namePrefix": "WB", "skipExisting": true } }
```

Effective threshold = `harvest.scoreThreshold` ?? `scoreThreshold` ?? `80`.
Prefix = `harvest.namePrefix` ?? `"WB"`.

## What to do
1. **Get the source.** Take the GitHub URL from the argument string. If empty, ask the user.
   Accept a repo URL (`https://github.com/owner/repo[.git]`), a `tree/<branch>/<subdir>` URL,
   or a URL pointing straight at one skill folder.
2. **Clone shallow** into the scratchpad temp dir (never into the project):
   `git clone --depth 1 <repo> <scratch>/wbharvest-<repo-name>`. For a `tree/…/subdir` URL,
   clone the repo then scope discovery to that subdir.
3. **Discover candidates.** Every directory that directly contains a `SKILL.md` is one
   candidate skill. List them with their paths.
4. **Score each candidate.** Delegate each to the `WBharvester` agent (run them in parallel
   when there are several). The agent returns strict JSON `{ score, proposedName, category,
   findings, summary, safety }`. `safety: "unsafe"` is an automatic reject regardless of score.
5. **Gate.** Keep a candidate only if `score >= threshold` **and** `safety != "unsafe"`.
6. **Import each kept skill** into `skills/<WBname>/`:
   - Compute `<WBname>` = prefix + PascalCase of the source slug (drop non-alphanumerics):
     `pdf → WBPdf`, `mcp-builder → WBMcpBuilder`, `web-artifacts-builder → WBWebArtifactsBuilder`.
     Prefer the agent's `proposedName` if it already follows this rule.
   - If `skipExisting` is true and `skills/<WBname>/` already exists, skip it (report as
     `skipped`); do not overwrite.
   - Copy the whole source skill folder (references/, scripts/, assets/, etc.) into
     `skills/<WBname>/` unchanged.
   - Rewrite only `SKILL.md`'s frontmatter: set `name: <WBname>`; keep/refine `description`
     and add a `recommendedModel` if the source lacks one. Keep the body instructions intact.
   - Append an attribution line at the end of the body:
     `> Harvested from \`<repo-url>\` (original: \`<slug>\`) · scored <score>/100 by WBharvest.`
   - If the source repo has a `LICENSE`/`NOTICE`, copy it into the skill folder too.
7. **Clean up** the temp clone from the scratchpad.

`log` per candidate: `<slug>: score=<n>/<threshold> -> <import WBname | reject | skip>`.

## Output
Print a table and a one-line summary:

```
WBharvest — <repo-url>  (gate: <threshold>/100)
| skill                | score | safety | result            |
|----------------------|-------|--------|-------------------|
| pdf                  |  92   |  ok    | imported: WBPdf   |
| slack-gif-creator    |  74   |  ok    | rejected (< 80)   |
| sketchy-installer    |  95   | unsafe | rejected (unsafe) |

Imported N of M skills into skills/. New WB* skills auto-register via plugin.json (./skills/).
```

## Rules
- **Never write a rejected or unsafe skill into `skills/`.** The gate is the whole point.
- Clone only into the scratchpad; never leave a nested repo or `.git` inside the project.
- Do not modify the source skills' behavior — only their frontmatter `name` and attribution.
- New skills are picked up by the existing `"skills": ["./skills/"]` glob; no plugin.json edit
  is needed for skills. (Only new *agents* must be added to plugin.json.)
- Match the user's language in the summary.
