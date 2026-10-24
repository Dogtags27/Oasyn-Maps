/**
 * verify-snapshot.mjs — read the R2 `latest` pointer and confirm the snapshot
 * objects it names exist and have sane sizes. A quick post-publish sanity check
 * and a precursor to the Hour 2 startup fetch (snapshot.ts).
 *
 * Run: `node scripts/verify-snapshot.mjs`
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2Env, getJson } from "./lib/r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, "..", ".env") });

const EXPECTED = [
  "graph.json", "parks.json", "trees.json", "water.json",
  "places.json", "buildings.json", "cooling.json", "meta.json",
];

async function main() {
  const env = r2Env();
  const client = r2Client(env);

  console.log(`[verify] reading pointer r2://${env.bucket}/${env.latestPointer}`);
  const pointer = await getJson(client, env.bucket, env.latestPointer);
  console.log(`[verify] latest version: ${pointer.version}`);
  console.log(`[verify] prefix: ${pointer.prefix}`);
  console.log(`[verify] meta: ${pointer.meta.nodes} nodes, ${pointer.meta.edges} edges, connected ${(pointer.meta.connectedFraction * 100).toFixed(1)}%`);

  let ok = true;
  for (const name of EXPECTED) {
    const Key = `${pointer.prefix}/${name}`;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: env.bucket, Key }));
      console.log(`[verify]   OK  ${name} (${(head.ContentLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      ok = false;
      console.error(`[verify]   MISSING ${name}: ${err.name}`);
    }
  }
  if (!ok) {
    console.error("[verify] snapshot incomplete");
    process.exitCode = 1;
  } else {
    console.log("[verify] snapshot complete and reachable");
  }
}

main().catch((err) => {
  console.error(`[verify] failed: ${err.message}`);
  process.exitCode = 1;
});
