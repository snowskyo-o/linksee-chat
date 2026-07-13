const { app, dialog } = require("electron");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let desktopPreferences = null;

function getDefaultDesktopPreferences() {
  return { downloadsDir: path.join(app.getPath("downloads"), "Linksee Chat"), launchOnStartup: false, notificationsMuted: false, closeToTray: true };
}

function getDesktopPreferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function loadDesktopPreferences() {
  const defaults = getDefaultDesktopPreferences();
  try {
    const filePath = getDesktopPreferencesPath();
    if (!fs.existsSync(filePath)) return defaults;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      downloadsDir: String(parsed?.downloadsDir || defaults.downloadsDir).trim() || defaults.downloadsDir,
      launchOnStartup: Boolean(parsed?.launchOnStartup),
      notificationsMuted: Boolean(parsed?.notificationsMuted),
      closeToTray: parsed?.closeToTray !== false,
    };
  } catch {
    return defaults;
  }
}

function getDesktopPreferences() {
  if (!desktopPreferences) desktopPreferences = loadDesktopPreferences();
  return desktopPreferences;
}

function writeDesktopPreferences(nextPreferences) {
  desktopPreferences = { ...getDefaultDesktopPreferences(), ...(nextPreferences || {}) };
  fs.writeFileSync(getDesktopPreferencesPath(), JSON.stringify(desktopPreferences, null, 2), "utf8");
  return desktopPreferences;
}

function getStorageInfo() {
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

function ensureStorageDirectories() {
  const storage = getStorageInfo();
  Object.values(storage).forEach((targetPath) => {
    if (!targetPath) return;
    fs.mkdirSync(targetPath, { recursive: true });
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
  const stem = parsed.name || "file";
  const extension = parsed.ext || "";
  let candidatePath = path.join(directoryPath, safeName);
  let index = 2;
  while (fs.existsSync(candidatePath)) {
    candidatePath = path.join(directoryPath, `${stem} (${index})${extension}`);
    index += 1;
  }
  return candidatePath;
}

function hashValue(value) {
  return createHash("sha1").update(String(value || "")).digest("hex");
}

async function ensureRemoteAvatarCached(sourceUrl) {
  const normalized = String(sourceUrl || "").trim();
  if (!/^https?:/i.test(normalized)) return "";
  const { avatars } = ensureStorageDirectories();
  const nextUrl = new URL(normalized);
  const extension = path.extname(nextUrl.pathname || "").toLowerCase() || ".img";
  const filePath = path.join(avatars, `${hashValue(normalized)}${extension}`);
  if (!fs.existsSync(filePath)) {
    const response = await fetch(normalized);
    if (!response.ok) throw new Error(`avatar fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  }
  return pathToFileURL(filePath).toString();
}

function ensureConversationCacheDir(conversationId = "shared") {
  const { chatCache } = ensureStorageDirectories();
  const target = path.join(chatCache, sanitizeFileName(conversationId, "shared"));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function ensureStateCacheDir(scope = "shared") {
  const { chatCache } = ensureStorageDirectories();
  const target = path.join(chatCache, "_state", sanitizeFileName(scope, "shared"));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function readStateCache(scope = "shared", key = "") {
  if (!key) return null;
  const filePath = path.join(ensureStateCacheDir(scope), `${sanitizeFileName(key, "cache")}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeStateCache(scope = "shared", key = "", data = null) {
  if (!key) return false;
  const filePath = path.join(ensureStateCacheDir(scope), `${sanitizeFileName(key, "cache")}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data ?? null, null, 2), "utf8");
  return true;
}

async function saveDownloadedAsset({ fileName, bytes, conversationId = "", cacheKey = "", saveAs = false }) {
  const safeName = sanitizeFileName(fileName, "attachment");
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const cacheDir = ensureConversationCacheDir(conversationId);
  const { exports } = ensureStorageDirectories();
  const stem = path.parse(safeName).name;
  const extension = path.extname(safeName);
  const uniqueSuffix = `${Date.now()}-${(cacheKey && hashValue(cacheKey).slice(0, 8)) || hashValue(safeName).slice(0, 8)}`;
  const cachePath = path.join(cacheDir, `${stem}-${uniqueSuffix}${extension}`);
  const defaultExportPath = buildUniqueFilePath(exports, safeName);
  let exportPath = defaultExportPath;
  if (saveAs) {
    const result = await dialog.showSaveDialog({
      title: "另存为",
      defaultPath: path.join(exports, safeName),
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
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
  ensureStorageDirectories,
  getDefaultDesktopPreferences,
  getDesktopPreferences,
  getStorageInfo,
  readStateCache,
  saveDownloadedAsset,
  writeDesktopPreferences,
  writeStateCache,
};
