/**
 * lint-nohardcode.mjs — no-hardcode / determinism guard (R14.2, R6.8).
 *
 * Enforces for every file under src/core/ (comments stripped first):
 *   - no Math.random (determinism principle)
 *   - no wall-clock reads: Date.now() / no-arg new Date() — `new Date(input)` ok
 *   - no stray hex colour literals
 *   - no SENTENCE literals (core emits Descriptor {key, vars}, never prose)
 * Exit code is non-zero on any violation. (Numeric formula coefficients are not
 * gated — they map to math.md, not config; see the note below.)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const coreDir = join(here, "..", "src", "core");

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // core/ may not exist until Hour 2.
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Strip // line comments and block comments so a comment that merely *mentions*
 * a banned token (e.g. "no Math.random here") doesn't trip the guard. Naive but
 * sufficient: string literals containing comment markers are rare in core/ and
 * are not the thing we gate on.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments (avoid matching "://")
}

/**
 * Detect SENTENCE literals in core/ (R14.2): core emits Descriptor {key, vars},
 * never prose. A sentence literal is a quoted string that reads like user-facing
 * text — multiple words with a space and sentence punctuation or capitalisation.
 * We allow descriptor keys (dotted, no spaces), import specifiers, and short
 * technical strings. False positives are easy to silence by moving text into a
 * descriptor, which is exactly the behaviour we want to enforce.
 */
function sentenceLiterals(code) {
  const hits = [];
  // Match single/double-quoted string literals (no template handling needed —
  // core has no user-facing template strings).
  const re = /(["'])((?:\\.|(?!\1).)*)\1/g;
  let mt;
  while ((mt = re.exec(code)) !== null) {
    const s = mt[2];
    if (!s.includes(" ")) continue; // identifiers / keys / paths never flagged
    // Allow strings that are clearly not prose: all lowercase with dots/slashes.
    if (/^[\w./@-]+$/.test(s)) continue;
    // Prose heuristic: 3+ words, OR a capitalised first word + ends with .!?.
    const words = s.trim().split(/\s+/);
    const looksProse =
      words.length >= 3 || (/^[A-Z]/.test(s) && /[.!?]$/.test(s.trim()));
    if (looksProse) hits.push(s.length > 40 ? s.slice(0, 40) + "…" : s);
  }
  return hits;
}

// NOTE on numeric constants: core/ is math-heavy and its formula coefficients
// map to math.md, not to config.ts. A blanket "magic number" ban would be noise,
// so we do not gate on numeric literals; the model constants that ARE tunable
// already live in config.ts (R14.1) and are imported, not duplicated.

const violations = [];
for (const file of walk(coreDir)) {
  const code = stripComments(readFileSync(file, "utf8"));
  if (/\bMath\.random\b/.test(code)) violations.push(`${file}: uses Math.random`);
  // Ban WALL-CLOCK reads only: Date.now() and the no-arg `new Date()`. Converting
  // an input timestamp via `new Date(timeMs)` is deterministic and allowed
  // (e.g. feeding suncalc), so it does not trip the guard.
  if (/\bDate\.now\s*\(/.test(code)) violations.push(`${file}: uses Date.now()`);
  if (/new Date\s*\(\s*\)/.test(code)) violations.push(`${file}: uses new Date() (wall clock)`);
  if (/#[0-9a-fA-F]{3,6}\b/.test(code)) violations.push(`${file}: stray hex literal`);

  const sentences = sentenceLiterals(code);
  for (const s of sentences) violations.push(`${file}: sentence literal "${s}" (use a descriptor)`);
}

if (violations.length) {
  console.error("[lint:nohardcode] violations:\n" + violations.map((v) => `  - ${v}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("[lint:nohardcode] ok");
}
