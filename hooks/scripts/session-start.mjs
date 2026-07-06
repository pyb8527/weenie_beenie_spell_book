#!/usr/bin/env node
// weenie-beenie SessionStart hook.
// Surfaces the active quality-gate config as session context so the model knows
// the pipeline exists and what its thresholds are. Fails silent — never breaks a session.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const defaults = { scoreThreshold: 80, maxRewrites: 3, onExhaustion: 'commit-warn' };
  let cfg = { ...defaults };
  try {
    const raw = readFileSync(join(cwd, 'weenie-beenie.config.json'), 'utf8');
    cfg = { ...defaults, ...JSON.parse(raw) };
  } catch {
    // no config file yet — use defaults
  }

  const context =
    `weenie-beenie pipeline available. Quality gate: review score >= ${cfg.scoreThreshold}, ` +
    `up to ${cfg.maxRewrites} rewrite round(s), on-exhaustion = "${cfg.onExhaustion}". ` +
    `Stages are independent skills — run only what you need: ` +
    `/WBplan <task>, /WBreview, /WBtest, /WBcommit.`;

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
