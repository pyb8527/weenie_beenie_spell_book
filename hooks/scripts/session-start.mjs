#!/usr/bin/env node
// wb-spell SessionStart hook.
// Surfaces the active quality-gate config as session context so the model knows
// the pipeline exists and what its thresholds are. Fails silent — never breaks a session.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const defaults = {
    scoreThreshold: 80,
    maxRewrites: 3,
    onExhaustion: 'escalate',
    failOnTestFailure: true,
    run: { issue: { github: false }, checkpoints: ['plan', 'ship'], maxCycles: 1 },
    ship: { mode: 'pr', branchPrefix: 'wb/', bumpPluginVersion: 'patch' },
    plan: { research: { mode: 'auto', maxScouts: 4 }, critique: true, maxReplans: 1 },
  };
  let cfg = { ...defaults };
  try {
    const raw = readFileSync(join(cwd, 'wb-spell.config.json'), 'utf8');
    cfg = { ...defaults, ...JSON.parse(raw) };
  } catch {
    // no config file yet — use defaults
  }

  const plan = { ...defaults.plan, ...(cfg.plan || {}) };
  const research = { ...defaults.plan.research, ...(plan.research || {}) };

  const researchNote = research.mode === 'off'
    ? `Plan research is disabled (plan.research.mode=off).`
    : `/WBplan first runs /WBresearch: up to ${research.maxScouts} WBscout agents research in ` +
      `parallel, one lens each, then WBresearchjudge verifies every claim at its cited source — ` +
      `only what survives reaches .wb/research.md, which the plan must be grounded in` +
      (research.mode === 'auto' ? ` (auto: skipped for trivial tasks).` : `.`);

  const run = { ...defaults.run, ...(cfg.run || {}) };
  const checkpoints = Array.isArray(run.checkpoints) ? run.checkpoints : defaults.run.checkpoints;
  // `commit` is the pre-0.3 name for the ship block — keep reading it so old configs still work.
  const ship = { ...defaults.ship, ...(cfg.commit || {}), ...(cfg.ship || {}) };

  const runNote =
    `/WBspell <task> is the main entry: writes .wb/issue.md from the request (or a GitHub issue ` +
    `via "#123"), then drives /WBplan -> /WBimplement -> /WBreview -> /WBship, logs .wb/run.md, ` +
    `and resumes an interrupted run. Pauses at checkpoint(s): ` +
    (checkpoints.length ? checkpoints.join(', ') : 'none (runs straight through)') +
    `. A gate that stops is a stop — never route around one. ` +
    `/WBship (formerly /WBcommit) delivers per ship.mode="${ship.mode}": ` +
    `commit | branch | pr (branch -> commit -> push -> PR, body written from the .wb/ artifacts, ` +
    `draft when below-gate). Confirm before pushing or opening a PR; never merge — the user does that.`;

  const planGate = plan.critique === false
    ? `Plan critique is disabled (plan.critique=false).`
    : `Plans are red-teamed before code: /WBcritique (WBplancritic) hunts security, blast-radius, ` +
      `grounding, parallel-safety and testability blockers and re-plans up to ${plan.maxReplans} ` +
      `time(s) — open blockers gate (not the score) and escalate to the user.`;

  const context =
    `wb-spell pipeline available. ${runNote} ${researchNote} ${planGate} Quality gate: tests must pass (a failing suite is an ` +
    `automatic BELOW-GATE regardless of the review score), then review score >= ${cfg.scoreThreshold}, ` +
    `up to ${cfg.maxRewrites} rewrite round(s), on-exhaustion = "${cfg.onExhaustion}". ` +
    `The review score is an LLM heuristic — not reproducible run-to-run and not for cross-change comparison; ` +
    `it ranks findings, it does not certify quality. ` +
    `Stages are independent skills — run only what you need: ` +
    `/WBspell <task> (all of it), /WBresearch <task>, /WBplan <task>, /WBcritique, /WBimplement, ` +
    `/WBreview, /WBtest, /WBship. ` +
    `Stages hand off through markdown artifacts in .wb/ — issue.md + run.md (orchestrator) ` +
    `-> research.md (verified facts) ` +
    `-> plan.md (units + parallelization) ` +
    `-> plan-review.md (plan critique) -> implement.md (live progress board, one row per unit) ` +
    `-> review.md + review.json -> test.md -> ship.md; each stage reads the previous one's ` +
    `file and writes its own. ` +
    `/WBplan archives the previous cycle into .wb/history/.`;

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
