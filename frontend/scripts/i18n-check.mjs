/**
 * i18n-check.mjs — i18n parity gate (R12.7).
 *
 *  - Every non-en locale has the same key set as en (no missing, no extra).
 *    Plural variants (key_one / key_other) are reconciled against their base.
 *  - Every key in backend/contract/messages.json exists in en.json.
 *  - Reports keys in en that appear unused across src/ (warning, not fatal,
 *    since some keys are rendered dynamically from backend descriptors).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const LOCALES = join(root, "src", "i18n", "locales");
const CONTRACT_MESSAGES = join(root, "..", "backend", "contract", "messages.json");
const SRC = join(root, "src");

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function baseKey(key) {
  return key.replace(PLURAL_SUFFIX, "");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

let failures = 0;

// Load locales.
const en = await readJson(join(LOCALES, "en.json"));
const enKeys = Object.keys(en);
const enBaseKeys = new Set(enKeys.map(baseKey));

const localeFiles = (await readdir(LOCALES)).filter((f) => f.endsWith(".json"));

for (const file of localeFiles) {
  if (file === "en.json") continue;
  const data = await readJson(join(LOCALES, file));
  const keys = Object.keys(data);
  const baseKeys = new Set(keys.map(baseKey));

  for (const k of enBaseKeys) {
    if (!baseKeys.has(k)) {
      console.error(`${file}: missing key "${k}"`);
      failures++;
    }
  }
  for (const k of baseKeys) {
    if (!enBaseKeys.has(k)) {
      console.error(`${file}: extra key "${k}" not in en`);
      failures++;
    }
  }
}

// Every contract message key must exist in en.json.
const contract = await readJson(CONTRACT_MESSAGES);
const contractKeys = Object.keys(contract).filter((k) => !k.startsWith("_"));
for (const k of contractKeys) {
  if (!enBaseKeys.has(baseKey(k))) {
    console.error(`en.json: missing contract message key "${k}"`);
    failures++;
  }
}

// Unused-key warning: scan src for each en key as a string literal.
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(p);
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      yield p;
    }
  }
}

let srcText = "";
for await (const f of walk(SRC)) {
  srcText += await readFile(f, "utf8");
}

// Keys the backend emits as descriptors (rendered dynamically) are exempt from
// the unused scan: route.*, turn.*, offer.*, oasis.*, body.*, escalation.*,
// coverage.*, weather.*, error.*, preset.*, trip.label.*, mode.* (by value).
const DYNAMIC_PREFIXES = [
  "route.",
  "turn.",
  "offer.",
  "oasis.",
  "body.",
  "escalation.",
  "coverage.",
  "weather.",
  "error.",
  "preset.",
  "trip.label",
  "mode.fastest",
  "mode.balanced",
  "mode.coolest",
  "band.",
  "landing.feature",
];

const unused = [];
for (const k of enBaseKeys) {
  if (DYNAMIC_PREFIXES.some((p) => k.startsWith(p))) continue;
  if (!srcText.includes(k)) unused.push(k);
}
if (unused.length > 0) {
  console.warn(`i18n:check warning: ${unused.length} possibly unused key(s):`);
  for (const k of unused) console.warn(`  - ${k}`);
}

if (failures > 0) {
  console.error(`i18n:check failed with ${failures} error(s).`);
  process.exit(1);
}
console.log("i18n:check passed.");
