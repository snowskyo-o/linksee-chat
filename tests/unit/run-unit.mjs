import assert from "node:assert/strict";

process.env.MINIO_PUBLIC_ORIGIN = "https://files.example.com";

const { toPublicMinioUrl } = await import("../../infra/storage/minio.mjs");

const source = "http://minio:9000/chat-files/path/file.txt?X-Amz-Signature=abc";
const result = toPublicMinioUrl(source);
const url = new URL(result);

assert.equal(url.origin, "https://files.example.com");
assert.equal(url.pathname, "/chat-files/path/file.txt");
assert.equal(url.searchParams.get("X-Amz-Signature"), "abc");

console.log("[unit] minio public URL rewrite ok");

