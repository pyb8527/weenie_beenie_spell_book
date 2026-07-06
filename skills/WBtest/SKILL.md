---
name: WBtest
description: Runs the project's test suite for the current changes and reports pass/fail with failure details. Standalone stage of weenie-beenie. Use for "WBtest", "run the tests", "check tests pass".
invocation_trigger: When the user wants to run the tests and see the result.
recommendedModel: sonnet
---

# WBtest — Test Stage

## Role
Run the tests and report the result. Standalone — run it whenever you want to check
the suite is green.

## Configuration
Read `weenie-beenie.config.json -> test.command`. If set, use it. Otherwise auto-detect.

## What to do
1. Delegate to the `WBtester` agent.
2. It runs `test.command` if configured, else auto-detects the runner:
   - `package.json` test script → `npm test`
   - `pytest` / `pyproject.toml` / `tests/` → `pytest -q`
   - `go.mod` → `go test ./...`
   - `Cargo.toml` → `cargo test`
   - none found → `no-tests` (not a failure)
3. Report pass/fail counts and the first few failures.

## Output
```
WBtest — <status>: <passed> passed, <failed> failed   (command: <cmd>)
<first failures, if any>
```

If tests fail, suggest the next move (e.g. "run /WBreview to fix, then /WBtest again") —
but do not fix code here.

## Rules
- Do not modify source or tests.
- Never report `pass` without actually running the suite.
- Match the user's language.
