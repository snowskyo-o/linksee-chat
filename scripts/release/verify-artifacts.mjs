import fs from "node:fs";
import path from "node:path";
import {
  assertArtifacts,
  getReleaseDir,
  getRequiredArtifacts,
  readPackageJson,
} from "./release-utils.mjs";

const pkg = readPackageJson();
const version = process.argv[2] || pkg.version;
const releaseDir = getReleaseDir(version);
const installerName = `Linksee Chat Setup ${version}.exe`;
const manifestPath = path.join(releaseDir, "release-manifest.json");

assertArtifacts(releaseDir, version);

const latestYml = fs.readFileSync(path.join(releaseDir, "latest.yml"), "utf8");
if (!latestYml.includes(`version: ${version}`)) {
  throw new Error(`latest.yml does not reference version ${version}`);
}
if (!latestYml.includes(installerName)) {
  throw new Error(`latest.yml does not reference ${installerName}`);
}

if (!fs.existsSync(manifestPath)) {
  throw new Error("release-manifest.json is missing. Run npm run release:manifest first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const artifactNames = new Set((manifest.artifacts || []).map((item) => item.name));
getRequiredArtifacts(version).forEach((name) => {
  if (!artifactNames.has(name)) throw new Error(`manifest is missing ${name}`);
});

console.log(`[release] artifacts verified for ${version}`);
