const fs = require("node:fs");
const path = require("node:path");

const STICKER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);
const META_FILE_NAME = ".stickers-meta.json";

function isStickerFile(filePath) {
  return STICKER_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function sanitizeStickerName(value) {
  return String(value || "")
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "sticker";
}

function fileToDataUrl(filePath) {
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

function getMetaFilePath(stickersDir) {
  return path.join(stickersDir, META_FILE_NAME);
}

function readStickerMeta(stickersDir) {
  const filePath = getMetaFilePath(stickersDir);
  if (!fs.existsSync(filePath)) return { order: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { order: Array.isArray(parsed?.order) ? parsed.order.map((item) => String(item || "")).filter(Boolean) : [] };
  } catch {
    return { order: [] };
  }
}

function writeStickerMeta(stickersDir, order = []) {
  fs.writeFileSync(getMetaFilePath(stickersDir), JSON.stringify({ order }, null, 2), "utf8");
}

function syncStickerOrder(stickersDir, fileNames = []) {
  const nextOrder = [...new Set([...readStickerMeta(stickersDir).order.filter((item) => fileNames.includes(item)), ...fileNames])];
  writeStickerMeta(stickersDir, nextOrder);
  return nextOrder;
}

function listStickerEntries(stickersDir) {
  if (!fs.existsSync(stickersDir)) return [];
  const entries = fs.readdirSync(stickersDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isStickerFile(entry.name))
    .map((entry) => {
      const filePath = path.join(stickersDir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        id: entry.name,
        name: path.parse(entry.name).name,
        fileName: entry.name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        src: fileToDataUrl(filePath),
      };
    });
  const order = syncStickerOrder(stickersDir, entries.map((item) => item.id));
  return entries.sort((left, right) => {
    const leftIndex = order.indexOf(left.id);
    const rightIndex = order.indexOf(right.id);
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function createUniqueStickerPath(stickersDir, baseName, extension, ignoreName = "") {
  let candidate = `${baseName}${extension}`;
  let nextPath = path.join(stickersDir, candidate);
  let counter = 1;
  while (fs.existsSync(nextPath) && candidate !== ignoreName) {
    candidate = `${baseName}_${counter}${extension}`;
    nextPath = path.join(stickersDir, candidate);
    counter += 1;
  }
  return { candidate, nextPath };
}

function copyStickerIntoLibrary(stickersDir, sourcePath, prefix = "") {
  if (!sourcePath || !fs.existsSync(sourcePath) || !isStickerFile(sourcePath)) return;
  const parsed = path.parse(sourcePath);
  const baseName = sanitizeStickerName(`${prefix ? `${prefix}_` : ""}${parsed.name}`);
  const { candidate, nextPath } = createUniqueStickerPath(stickersDir, baseName, parsed.ext.toLowerCase());
  fs.copyFileSync(sourcePath, nextPath);
  syncStickerOrder(stickersDir, [...listStickerEntries(stickersDir).map((item) => item.id), candidate]);
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

function renameStickerEntry(stickersDir, stickerId, nextName) {
  const currentId = String(stickerId || "").trim();
  const targetName = sanitizeStickerName(nextName);
  if (!currentId || !targetName) return listStickerEntries(stickersDir);
  const currentPath = path.join(stickersDir, currentId);
  if (!fs.existsSync(currentPath)) return listStickerEntries(stickersDir);
  const parsed = path.parse(currentPath);
  const { candidate, nextPath } = createUniqueStickerPath(stickersDir, targetName, parsed.ext.toLowerCase(), currentId);
  if (candidate !== currentId) fs.renameSync(currentPath, nextPath);
  const order = syncStickerOrder(stickersDir, listStickerEntries(stickersDir).map((item) => item.id)).map((item) => (item === currentId ? candidate : item));
  writeStickerMeta(stickersDir, order);
  return listStickerEntries(stickersDir);
}

function deleteStickerEntry(stickersDir, stickerId) {
  const currentId = String(stickerId || "").trim();
  const currentPath = path.join(stickersDir, currentId);
  if (currentId && fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
  syncStickerOrder(stickersDir, listStickerEntries(stickersDir).map((item) => item.id));
  return listStickerEntries(stickersDir);
}

function moveStickerEntry(stickersDir, stickerId, direction = 0) {
  const currentId = String(stickerId || "").trim();
  const order = syncStickerOrder(stickersDir, listStickerEntries(stickersDir).map((item) => item.id));
  const fromIndex = order.indexOf(currentId);
  const toIndex = fromIndex + Number(direction || 0);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= order.length) return listStickerEntries(stickersDir);
  const nextOrder = order.slice();
  const [moved] = nextOrder.splice(fromIndex, 1);
  nextOrder.splice(toIndex, 0, moved);
  writeStickerMeta(stickersDir, nextOrder);
  return listStickerEntries(stickersDir);
}

module.exports = {
  STICKER_EXTENSIONS,
  listStickerEntries,
  copyStickerIntoLibrary,
  walkStickerFiles,
  renameStickerEntry,
  deleteStickerEntry,
  moveStickerEntry,
};
