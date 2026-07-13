const fs = require("node:fs");
const path = require("node:path");

const STICKER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const META_FILE_NAME = "emoji.json";
const ORI_DIR_NAME = "ori";
const THUMB_DIR_NAME = "thumb";

function isStickerFile(filePath) {
  return STICKER_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function sanitizeStickerName(value) {
  return String(value || "")
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "sticker";
}

function createDataUrl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".gif"
      ? "image/gif"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".bmp"
          ? "image/bmp"
          : extension === ".svg"
            ? "image/svg+xml"
            : "image/png";
  return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function isAnimatedStickerExtension(extension = "") {
  return [".gif", ".webp"].includes(String(extension || "").toLowerCase());
}

function ensureLibraryDirs(stickersDir) {
  const oriDir = path.join(stickersDir, ORI_DIR_NAME);
  const thumbDir = path.join(stickersDir, THUMB_DIR_NAME);
  fs.mkdirSync(oriDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });
  return { oriDir, thumbDir, metaPath: path.join(stickersDir, META_FILE_NAME) };
}

function createStickerId(name) {
  return `${sanitizeStickerName(name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function walkStickerFiles(rootPath, bucket = [], depth = 0) {
  if (!rootPath || !fs.existsSync(rootPath) || depth > 3) return bucket;
  fs.readdirSync(rootPath, { withFileTypes: true }).forEach((entry) => {
    const nextPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) return void walkStickerFiles(nextPath, bucket, depth + 1);
    if (entry.isFile() && isStickerFile(nextPath)) bucket.push(nextPath);
  });
  return bucket;
}

module.exports = {
  STICKER_EXTENSIONS,
  createDataUrl,
  createStickerId,
  ensureLibraryDirs,
  isAnimatedStickerExtension,
  isStickerFile,
  sanitizeStickerName,
  walkStickerFiles,
};
