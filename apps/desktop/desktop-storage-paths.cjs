const { app } = require("electron");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function getDefaultDesktopPreferences() {
  return { downloadsDir: path.join(app.getPath("downloads"), "Linksee Chat"), launchOnStartup: false, notificationsMuted: false, closeToTray: true };
}

function getDesktopPreferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function getStorageInfo(getDesktopPreferences) {
  const preferences = getDesktopPreferences();
  const root = app.getPath("userData");
  const downloads = String(preferences.downloadsDir || "").trim() || path.join(app.getPath("downloads"), "Linksee Chat");
  return {
    root,
    stickers: path.join(root, "stickers"),
    avatars: path.join(root, "avatars-cache"),
    chatCache: path.join(root, "chat-cache"),
    downloads,
    exports: downloads,
  };
}

function ensureStorageDirectories(getDesktopPreferences) {
  const storage = getStorageInfo(getDesktopPreferences);
  Object.values(storage).forEach((targetPath) => {
    if (targetPath) fs.mkdirSync(targetPath, { recursive: true });
  });
  return storage;
}

function sanitizeFileName(value, fallback = "file") {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function buildUniqueFilePath(directoryPath, safeName) {
  const parsed = path.parse(safeName);
  let candidatePath = path.join(directoryPath, safeName);
  let index = 2;
  while (fs.existsSync(candidatePath)) {
    candidatePath = path.join(directoryPath, `${parsed.name || "file"} (${index})${parsed.ext || ""}`);
    index += 1;
  }
  return candidatePath;
}

function hashValue(value) {
  return createHash("sha1").update(String(value || "")).digest("hex");
}

function ensureConversationCacheDir(getDesktopPreferences, conversationId = "shared") {
  const { chatCache } = ensureStorageDirectories(getDesktopPreferences);
  const target = path.join(chatCache, sanitizeFileName(conversationId, "shared"));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function ensureStateCacheDir(getDesktopPreferences, scope = "shared") {
  const { chatCache } = ensureStorageDirectories(getDesktopPreferences);
  const target = path.join(chatCache, "_state", sanitizeFileName(scope, "shared"));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

module.exports = {
  buildUniqueFilePath,
  ensureConversationCacheDir,
  ensureStateCacheDir,
  ensureStorageDirectories,
  getDefaultDesktopPreferences,
  getDesktopPreferencesPath,
  getStorageInfo,
  hashValue,
  sanitizeFileName,
};
