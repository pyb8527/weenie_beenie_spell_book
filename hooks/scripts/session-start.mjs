#!/usr/bin/env node
// wb-spell SessionStart hook.
// Surfaces the active quality-gate config as session context so the model knows
// the pipeline exists and what its thresholds are. Fails silent — never breaks a session.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const defaults = { scoreThreshold: 80, maxRewrites: 3, onExhaustion: 'escalate', failOnTestFailure: true };
  let cfg = { ...defaults };
  try {
    const raw = readFileSync(join(cwd, 'wb-spell.config.json'), 'utf8');
    cfg = { ...defaults, ...JSON.parse(raw) };
  } catch {
    // no config file yet — use defaults
  }

  const context =
    `wb-spell pipeline available. Quality gate: tests must pass (a failing suite is an ` +
    `automatic BELOW-GATE regardless of the review score), then review score >= ${cfg.scoreThreshold}, ` +
    `up to ${cfg.maxRewrites} rewrite round(s), on-exhaustion = "${cfg.onExhaustion}". ` +
    `The review score is an LLM heuristic — not reproducible run-to-run and not for cross-change comparison; ` +
    `it ranks findings, it does not certify quality. ` +
    `Stages are independent skills — run only what you need: ` +
    `/WBplan <task>, /WBimplement, /WBreview, /WBtest, /WBcommit.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
    }),
  );
} catch {
  // swallow everything — a hook must never crash the session
}

process.exit(0);
