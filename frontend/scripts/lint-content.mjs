/**
 * lint-content.mjs — content safety gate (R3.7, R16.2).
 *
 * Fails if any source or locale file contains an emoji or a denylisted term.
 * Runs in CI and on save. The denylist targets jokes about bodies/age/
 * disability/weight/illness and gendered or ableist idioms; it is intentionally
 * conservative and easy to extend.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(root, "src");

// Broad emoji ranges (pictographic + regional indicators + dingbats).
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/u;

// Denylisted substrings (lowercased). Extend as review surfaces issues.
const DENYLIST = [
  "lame",
  "crazy",
  "insane",
  "dumb",
  "retard",
  "spaz",
  "crippled",
  "obese joke",
];

const EXTS = new Set([".ts", ".tsx", ".json", ".css", ".html", ".md"]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(p);
    } else if (EXTS.has(extname(entry.name))) {
      yield p;
    }
  }
}

let failures = 0;
for await (const file of walk(SRC)) {
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (EMOJI.test(line)) {
      console.error(`${file}:${i + 1}: emoji found`);
      failures++;
    }
    const lower = line.toLowerCase();
    for (const term of DENYLIST) {
      if (lower.includes(term)) {
        console.error(`${file}:${i + 1}: denylisted term "${term}"`);
        failures++;
      }
    }
  });
}

if (failures > 0) {
  console.error(`lint:content failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log("lint:content passed.");
