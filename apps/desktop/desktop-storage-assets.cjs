const { dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  buildUniqueFilePath,
  ensureConversationCacheDir,
  ensureStorageDirectories,
  hashValue,
  sanitizeFileName,
} = require("./desktop-storage-paths.cjs");

async function ensureRemoteAvatarCached(getDesktopPreferences, sourceUrl) {
  const normalized = String(sourceUrl || "").trim();
  if (!/^https?:/i.test(normalized)) return "";
  const { avatars } = ensureStorageDirectories(getDesktopPreferences);
  const nextUrl = new URL(normalized);
  const extension = path.extname(nextUrl.pathname || "").toLowerCase() || ".img";
  const filePath = path.join(avatars, `${hashValue(normalized)}${extension}`);
  if (!fs.existsSync(filePath)) {
    const response = await fetch(normalized);
    if (!response.ok) throw new Error(`avatar fetch failed: ${response.status}`);
    fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  }
  return pathToFileURL(filePath).toString();
}

async function saveDownloadedAsset(getDesktopPreferences, { fileName, bytes, conversationId = "", cacheKey = "", saveAs = false }) {
  const safeName = sanitizeFileName(fileName, "attachment");
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const cacheDir = ensureConversationCacheDir(getDesktopPreferences, conversationId);
  const { exports } = ensureStorageDirectories(getDesktopPreferences);
  const parsed = path.parse(safeName);
  const uniqueSuffix = `${Date.now()}-${(cacheKey && hashValue(cacheKey).slice(0, 8)) || hashValue(safeName).slice(0, 8)}`;
  const cachePath = path.join(cacheDir, `${parsed.name}-${uniqueSuffix}${parsed.ext}`);
  let exportPath = buildUniqueFilePath(exports, safeName);
  if (saveAs) {
    const result = await dialog.showSaveDialog({ title: "另存为", defaultPath: path.join(exports, safeName) });
    if (result.canceled || !result.filePath) return { canceled: true };
    exportPath = result.filePath;
  }
  fs.writeFileSync(cachePath, payload);
  fs.writeFileSync(exportPath, payload);
  return {
    canceled: false,
    cachePath,
    exportPath,
    cacheUrl: pathToFileURL(cachePath).toString(),
    exportUrl: pathToFileURL(exportPath).toString(),
  };
}

module.exports = {
  ensureRemoteAvatarCached,
  saveDownloadedAsset,
};
