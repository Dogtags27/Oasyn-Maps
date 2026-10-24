/**
 * r2.mjs — thin Cloudflare R2 helper (S3-compatible API).
 *
 * Credentials come from the environment only (loaded from .env by the caller).
 * Never hardcode secrets. Used by the build script to publish snapshots and by
 * the startup fetch to pull them.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

/** Reads R2 settings from the environment; throws if anything required is missing. */
export function r2Env() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const latestPointer =
    process.env.R2_LATEST_POINTER ?? "snapshots/inner-metro/latest.json";
  const missing = Object.entries({ endpoint, bucket, accessKeyId, secretAccessKey })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Missing R2 env vars: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`,
    );
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, latestPointer };
}

/** Builds an S3Client pointed at R2. */
export function r2Client(env = r2Env()) {
  return new S3Client({
    region: "auto",
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
}

/** Uploads a Buffer/string to a key. */
export async function putObject(client, bucket, key, body, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Downloads a key and returns it as a Buffer. */
export async function getObject(client, bucket, key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** Downloads a JSON key and parses it. */
export async function getJson(client, bucket, key) {
  const buf = await getObject(client, bucket, key);
  return JSON.parse(buf.toString("utf8"));
}
