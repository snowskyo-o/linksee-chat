import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
}

export function getReleaseDir(version = readPackageJson().version) {
  return path.join(repoRoot, "release", "desktop", version);
}

export function getChannelFromVersion(version = readPackageJson().version) {
  return /-(rc|beta|alpha)\./i.test(version) ? "staging" : "stable";
}

export function sha512File(filePath) {
  const hash = crypto.createHash("sha512");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("base64");
}

export function getRequiredArtifacts(version = readPackageJson().version) {
  return [
    "latest.yml",
    `Linksee Chat Setup ${version}.exe`,
    `Linksee Chat Setup ${version}.exe.blockmap`,
  ];
}

export function assertArtifacts(releaseDir, version = readPackageJson().version) {
  const missing = getRequiredArtifacts(version).filter((name) => !fs.existsSync(path.join(releaseDir, name)));
  if (missing.length) {
    throw new Error(`Missing release artifacts: ${missing.join(", ")}`);
  }
}
