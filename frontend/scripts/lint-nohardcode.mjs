/**
 * lint-nohardcode.mjs — jsx-no-literals + no-hex gates (R3.1, R12.2).
 *
 *  - no-hex: no colour literal (#rgb/#rrggbb, rgb(), hsl()) outside tokens/.
 *    Colour must come from @theme tokens only.
 *  - jsx-no-literals: no user-facing sentence literal in JSX text or in common
 *    text-bearing attributes (aria-label, title, placeholder, alt). All copy
 *    goes through t() or arrives as a Descriptor.
 *
 * The checks are heuristic and deliberately conservative: they flag obvious
 * violations (words with spaces) while allowing className strings, keys, and
 * single tokens.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(root, "src");

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB_HSL = /\b(rgb|rgba|hsl|hsla)\s*\(/;

// JSX text node with letters and at least one space -> a sentence literal.
const JSX_TEXT = />\s*([A-Za-z][A-Za-z ,.'!?;:()-]{3,})\s*</;
// Text-bearing attributes with a quoted multi-word English string.
const TEXT_ATTR =
  /\b(aria-label|title|placeholder|alt)\s*=\s*"([A-Za-z]+ [A-Za-z ,.'!?;:()-]+)"/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

let failures = 0;

for await (const file of walk(SRC)) {
  const ext = extname(file);
  const rel = relative(root, file);
  const inTokens = rel.includes(`src/tokens`) || rel.includes(`src\\tokens`);
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    // no-hex (skip tokens/ which defines the palette, and .json data files).
    if (!inTokens && ext !== ".json") {
      if (HEX.test(line) || RGB_HSL.test(line)) {
        console.error(`${rel}:${i + 1}: colour literal outside tokens`);
        failures++;
      }
    }

    // jsx-no-literals (only .tsx component files).
    if (ext === ".tsx") {
      if (JSX_TEXT.test(line)) {
        const m = JSX_TEXT.exec(line);
        // Allow lines that are clearly expressions (contain { } interpolation).
        if (m && !line.includes("{") ) {
          console.error(`${rel}:${i + 1}: literal JSX text "${m[1].trim()}"`);
          failures++;
        }
      }
      if (TEXT_ATTR.test(line) && !line.includes("t(")) {
        const m = TEXT_ATTR.exec(line);
        console.error(`${rel}:${i + 1}: literal ${m[1]} "${m[2]}"`);
        failures++;
      }
    }
  });
}

if (failures > 0) {
  console.error(`lint:nohardcode failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log("lint:nohardcode passed.");
