---
name: WBtest
description: Runs the project's test suite for the current changes, reports pass/fail with failure details, and records the run in `.wb/test.md`. Standalone stage of wb-spell. Use for "WBtest", "run the tests", "check tests pass".
invocation_trigger: When the user wants to run the tests and see the result.
recommendedModel: sonnet
---

# WBtest — Test Stage

## Role
Run the tests, report the result, and leave a `.wb/test.md` record. Standalone — run it
whenever you want to check the suite is green.

## Configuration
Read `wb-spell.config.json -> test.command`. If set, use it. Otherwise auto-detect.

## What to do
1. If `.wb/implement.md` exists, read its **Changed files** and **Handoff to review** so
   you can say which changed files the suite actually covers.
2. Delegate to the `WBtester` agent.
3. It runs `test.command` if configured, else auto-detects the runner:
   - `package.json` test script → `npm test`
   - `pytest` / `pyproject.toml` / `tests/` → `pytest -q`
   - `go.mod` → `go test ./...`
   - `Cargo.toml` → `cargo test`
   - none found → `no-tests` (not a failure)
4. Write `.wb/test.md` (template below; overwrite) and report pass/fail counts with the
   first few failures.

## `.wb/test.md` template
```markdown
---
stage: test
task: <from plan/implement frontmatter, or "ad-hoc">
status: pass | fail | no-tests
command: <the command that ran>
passed: <n>
failed: <n>
updated: <YYYY-MM-DD HH:MM>
---

# Test report — <task>

## Result
**<PASS | FAIL | NO TESTS>** — `<n>` passed, `<n>` failed via `<command>`.

## Failures
### 1. <test name> — `path/file:line`
```
<short failure message>
```

## Coverage of this change
- `<changed file>` — covered by `<test>` | **not covered**

## Notes
- <flaky/skipped/env caveats, or why no runner was found> | none
```

## Output
```
WBtest — <status>: <passed> passed, <failed> failed   (command: <cmd>)
<first failures, if any>
(report: .wb/test.md)
```

If tests fail, suggest the next move (e.g. "run /WBreview to fix, then /WBtest again") —
but do not fix code here.

## Rules
- Do not modify source or tests.
- Never report `pass` without actually running the suite.
- `.wb/test.md` belongs to this skill; WBreview records its own gate test runs in
  `.wb/review.md`'s round log instead of overwriting this file.
- Match the user's language.
