/** Type declarations for the Cloudflare R2 helper (r2.mjs). */

import type { S3Client } from "@aws-sdk/client-s3";

export interface R2Env {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  latestPointer: string;
}

export function r2Env(): R2Env;
export function r2Client(env?: R2Env): S3Client;
export function putObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<void>;
export function getObject(client: S3Client, bucket: string, key: string): Promise<Buffer>;
export function getJson(client: S3Client, bucket: string, key: string): Promise<unknown>;
