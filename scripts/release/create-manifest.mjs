import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  assertArtifacts,
  getChannelFromVersion,
  getReleaseDir,
  getRequiredArtifacts,
  readPackageJson,
  sha512File,
} from "./release-utils.mjs";

const pkg = readPackageJson();
const version = process.argv[2] || pkg.version;
const channel = process.env.RELEASE_CHANNEL || getChannelFromVersion(version);
const releaseDir = getReleaseDir(version);

assertArtifacts(releaseDir, version);

function gitValue(args, fallback = "") {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

const artifacts = getRequiredArtifacts(version).map((name) => {
  const filePath = path.join(releaseDir, name);
  const stat = fs.statSync(filePath);
  return {
    name,
    size: stat.size,
    sha512: sha512File(filePath),
  };
});

const manifest = {
  productName: pkg.build?.productName || pkg.name,
  version,
  channel,
  commit: gitValue(["rev-parse", "HEAD"]),
  branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
  builtAt: new Date().toISOString(),
  updateFeed: `${process.env.RELEASE_FEED_URL || pkg.build?.publish?.url || ""}`.replace(/\/$/, ""),
  checks: {
    buildWeb: true,
    unitTests: true,
    desktopPackage: true,
    artifactVerify: true,
  },
  artifacts,
};

fs.writeFileSync(path.join(releaseDir, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`[release] manifest written for ${version} (${channel})`);
