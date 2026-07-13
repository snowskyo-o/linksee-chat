const fs = require("node:fs");
const path = require("node:path");
const { ensureStateCacheDir, sanitizeFileName } = require("./desktop-storage-paths.cjs");

function readStateCache(getDesktopPreferences, scope = "shared", key = "") {
  if (!key) return null;
  const filePath = path.join(ensureStateCacheDir(getDesktopPreferences, scope), `${sanitizeFileName(key, "cache")}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeStateCache(getDesktopPreferences, scope = "shared", key = "", data = null) {
  if (!key) return false;
  const filePath = path.join(ensureStateCacheDir(getDesktopPreferences, scope), `${sanitizeFileName(key, "cache")}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data ?? null, null, 2), "utf8");
  return true;
}

module.exports = {
  readStateCache,
  writeStateCache,
};
