import fs from "node:fs";
import path from "node:path";
import {
  getReleaseDir,
  readPackageJson,
  sha512File,
} from "./release-utils.mjs";

const pkg = readPackageJson();
const version = process.argv[2] || pkg.version;
const releaseDir = getReleaseDir(version);
const installerName = `Linksee Chat Setup ${version}.exe`;
const installerPath = path.join(releaseDir, installerName);

if (!fs.existsSync(installerPath)) {
  throw new Error(`Installer is missing: ${installerName}`);
}

const installer = fs.statSync(installerPath);
const sha512 = sha512File(installerPath);
const latestYml = [
  `version: ${version}`,
  "files:",
  `  - url: ${installerName}`,
  `    sha512: ${sha512}`,
  `    size: ${installer.size}`,
  `path: ${installerName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  "",
].join("\n");

fs.writeFileSync(path.join(releaseDir, "latest.yml"), latestYml, "utf8");
console.log(`[release] update metadata written for ${version}`);
