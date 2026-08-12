#!/usr/bin/env node
// wb-spell — deterministic static safety scan for a candidate skill folder.
//
// This is a CODE gate, not a prompt. WBharvest runs it on every candidate BEFORE the
// LLM judge and BEFORE anything is written into skills/. An LLM asked to vet untrusted
// content is exactly the target of prompt injection; this pass does not read intent — it
// grep-matches for capabilities that a documentation skill has no business shipping.
//
// Usage:  node scan-skill.mjs <candidate-skill-dir>
// Output: JSON on stdout -> { "risky": bool, "hitCount": n, "hits": [ { file, line, rule, snippet } ] }
// Exit:   0 = clean, 2 = risky (hits found), 1 = usage/error.
//
// A hit does NOT auto-reject; it means "cannot be auto-imported — needs human review".
// The whole point is that this decision is never left to the model alone.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const root = process.argv[2];
if (!root) {
  process.stderr.write('usage: node scan-skill.mjs <candidate-skill-dir>\n');
  process.exit(1);
}

// Files we scan as text. Skip binaries/assets.
const TEXT_EXT = new Set([
  '.md', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.jsx', '.json', '.sh', '.bash',
  '.zsh', '.py', '.rb', '.ps1', '.yml', '.yaml', '.txt', '.html', '.dot', '',
]);
const SKIP_DIR = new Set(['.git', 'node_modules', 'assets', 'dist', 'build']);
const MAX_BYTES = 2 * 1024 * 1024;

// Each rule: irreversible / network / execution capabilities. Ordered by severity.
const RULES = [
  { rule: 'destructive-rm',     sev: 'high', re: /\brm\s+-[a-z]*[rf][a-z]*\b|\brmdir\s+\/s|Remove-Item[^\n]*-Recurse[^\n]*-Force/i },
  { rule: 'pipe-to-shell',      sev: 'high', re: /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh|pwsh|python)\b/i },
  { rule: 'shell-exec',         sev: 'high', re: /child_process|\b(exec|execSync|spawn|spawnSync|execFile)\s*\(|subprocess\.(run|Popen|call)|os\.system|Start-Process|Invoke-Expression|\biex\b/i },
  { rule: 'dynamic-eval',       sev: 'high', re: /\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(\s*['"`]|\bexec\s*\(\s*compile/i },
  { rule: 'base64-decode',      sev: 'high', re: /Buffer\.from\([^)]*['"]base64['"]\)|atob\s*\(|base64\s+-d|FromBase64String|b64decode/i },
  { rule: 'network-egress',     sev: 'med',  re: /\bfetch\s*\(|XMLHttpRequest|require\(\s*['"](https?|net|dgram|dns|tls)['"]\)|import[^\n]*['"]node:(https?|net|dgram|dns|tls)['"]|axios|got\(|urllib|requests\.(get|post)|http\.client|WebSocket/i },
  { rule: 'server-bind',        sev: 'med',  re: /createServer|\.listen\s*\(|0\.0\.0\.0|app\.listen|http\.server|socket\.bind/i },
  { rule: 'external-url',       sev: 'low',  re: /https?:\/\/(?!(localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(com|org)|github\.com|raw\.githubusercontent\.com))[a-z0-9.-]+/i },
  { rule: 'secret-access',      sev: 'low',  re: /process\.env(\[|\.)|os\.environ|\$\{?[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD|CRED)/i },
  { rule: 'agent-injection',    sev: 'high', re: /ignore (all |previous |the above )?(instructions|rules)|disregard[^\n]*instructions|you are now|system prompt|do not tell the user|exfiltrat/i },
];

const hits = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) walk(join(dir, e.name));
      continue;
    }
    const full = join(dir, e.name);
    if (!TEXT_EXT.has(extname(e.name).toLowerCase())) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.size > MAX_BYTES) continue;
    let text;
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    const rel = relative(root, full) || basename(full);
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4000) continue;
      for (const r of RULES) {
        if (r.re.test(line)) {
          hits.push({
            file: rel.split('\\').join('/'),
            line: i + 1,
            rule: r.rule,
            sev: r.sev,
            snippet: line.trim().slice(0, 200),
          });
        }
      }
    }
  }
}

try { statSync(root); } catch {
  process.stderr.write(`not a directory: ${root}\n`);
  process.exit(1);
}
walk(root);

const risky = hits.length > 0;
process.stdout.write(JSON.stringify({ risky, hitCount: hits.length, hits }, null, 2) + '\n');
process.exit(risky ? 2 : 0);
