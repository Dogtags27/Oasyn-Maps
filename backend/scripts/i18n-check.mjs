/**
 * i18n-check.mjs — descriptor-parity check (R13.4).
 *
 * Confirms that every descriptor key referenced in the committed fixtures
 * exists in contract/messages.json. This mirrors one half of contract.test.ts
 * so it can run standalone in a hook (Hour 6). Exit code is non-zero on a gap.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const contractDir = join(here, "..", "contract");
const fixturesDir = join(contractDir, "fixtures");

const messages = JSON.parse(readFileSync(join(contractDir, "messages.json"), "utf8"));
const known = new Set(Object.keys(messages).filter((k) => !k.startsWith("_")));

function collect(value, acc) {
  if (Array.isArray(value)) {
    for (const v of value) collect(v, acc);
  } else if (value && typeof value === "object") {
    if (typeof value.key === "string" && Object.keys(value).every((k) => k === "key" || k === "vars")) {
      acc.add(value.key);
    }
    for (const v of Object.values(value)) collect(v, acc);
  }
}

const used = new Set();
for (const f of readdirSync(fixturesDir)) {
  if (!f.endsWith(".json")) continue;
  const { response } = JSON.parse(readFileSync(join(fixturesDir, f), "utf8"));
  collect(response, used);
}

const missing = [...used].filter((k) => !known.has(k));
if (missing.length) {
  console.error(`[i18n:check] missing keys in messages.json: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`[i18n:check] ok (${used.size} keys referenced, all present)`);
}
