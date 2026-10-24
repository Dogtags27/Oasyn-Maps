/**
 * lint-nohardcode.mjs — no-hardcode / determinism guard (R14.2, R6.8).
 *
 * Fleshed out fully in Hour 5 (task 29). Hour 1 ships a working skeleton that
 * already enforces the two cheapest rules so the script and npm wiring exist:
 *   - core/ must not import `Date` or `Math.random` (determinism principle).
 *   - core/ must not contain stray hex colour literals.
 *
 * Sentence-literal detection and duplicated-constant detection are added in
 * Hour 5. Exit code is non-zero on any violation.
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
}

if (violations.length) {
  console.error("[lint:nohardcode] violations:\n" + violations.map((v) => `  - ${v}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("[lint:nohardcode] ok");
}
