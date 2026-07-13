const fs = require("node:fs");
const path = require("node:path");
const { nativeImage } = require("electron");

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

function ensureLibraryDirs(stickersDir) {
  const oriDir = path.join(stickersDir, ORI_DIR_NAME);
  const thumbDir = path.join(stickersDir, THUMB_DIR_NAME);
  fs.mkdirSync(oriDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });
  return { oriDir, thumbDir, metaPath: path.join(stickersDir, META_FILE_NAME) };
}

function readStickerMeta(stickersDir) {
  const { metaPath } = ensureLibraryDirs(stickersDir);
  if (!fs.existsSync(metaPath)) return { order: [], items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return {
      order: Array.isArray(parsed?.order) ? parsed.order.map((item) => String(item || "")).filter(Boolean) : [],
      items: Array.isArray(parsed?.items) ? parsed.items.filter(Boolean) : [],
    };
  } catch {
    return { order: [], items: [] };
  }
}

function writeStickerMeta(stickersDir, meta = {}) {
  const { metaPath } = ensureLibraryDirs(stickersDir);
  const payload = {
    order: Array.isArray(meta.order) ? meta.order : [],
    items: Array.isArray(meta.items) ? meta.items : [],
  };
  fs.writeFileSync(metaPath, JSON.stringify(payload, null, 2), "utf8");
}

function createStickerId(name) {
  return `${sanitizeStickerName(name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function resolveThumbBuffer(sourcePath) {
  const image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) return fs.readFileSync(sourcePath);
  return image.resize({ width: 96, height: 96, quality: "good" }).toPNG();
}

function createStickerRecord(stickersDir, sourcePath, suggestedName = "") {
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  const parsed = path.parse(sourcePath);
  const displayName = sanitizeStickerName(suggestedName || parsed.name);
  const id = createStickerId(displayName);
  const originalFileName = `${id}${parsed.ext.toLowerCase()}`;
  const thumbFileName = `${id}.png`;
  const originalPath = path.join(oriDir, originalFileName);
  const thumbPath = path.join(thumbDir, thumbFileName);
  fs.copyFileSync(sourcePath, originalPath);
  fs.writeFileSync(thumbPath, resolveThumbBuffer(sourcePath));
  return {
    id,
    name: displayName,
    originalFileName,
    thumbFileName,
    size: fs.statSync(originalPath).size,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMeta(stickersDir) {
  const meta = readStickerMeta(stickersDir);
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  const items = meta.items.filter((item) => (
    item?.id
    && item?.originalFileName
    && item?.thumbFileName
    && fs.existsSync(path.join(oriDir, item.originalFileName))
    && fs.existsSync(path.join(thumbDir, item.thumbFileName))
  ));
  const order = [...new Set([...meta.order.filter((id) => items.some((item) => item.id === id)), ...items.map((item) => item.id)])];
  writeStickerMeta(stickersDir, { order, items });
  return { order, items };
}

function migrateLegacyStickers(stickersDir) {
  const { oriDir } = ensureLibraryDirs(stickersDir);
  const meta = normalizeMeta(stickersDir);
  const knownOriginals = new Set(meta.items.map((item) => item.originalFileName));
  const legacyFiles = fs.readdirSync(stickersDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isStickerFile(entry.name) && !knownOriginals.has(entry.name))
    .map((entry) => path.join(stickersDir, entry.name));
  if (!legacyFiles.length) return meta;
  const nextItems = meta.items.slice();
  const nextOrder = meta.order.slice();
  legacyFiles.forEach((filePath) => {
    const displayName = path.parse(filePath).name;
    const record = createStickerRecord(stickersDir, filePath, displayName);
    nextItems.push(record);
    nextOrder.push(record.id);
    const movedPath = path.join(oriDir, path.basename(filePath));
    if (fs.existsSync(filePath) && path.resolve(filePath) !== path.resolve(movedPath)) fs.unlinkSync(filePath);
  });
  writeStickerMeta(stickersDir, { order: nextOrder, items: nextItems });
  return normalizeMeta(stickersDir);
}

function listStickerEntries(stickersDir) {
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  const meta = migrateLegacyStickers(stickersDir);
  return meta.order
    .map((id) => meta.items.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      name: item.name,
      fileName: item.originalFileName,
      size: Number(item.size || 0),
      updatedAt: item.updatedAt || "",
      src: createDataUrl(path.join(thumbDir, item.thumbFileName)),
      originalSrc: createDataUrl(path.join(oriDir, item.originalFileName)),
    }));
}

function copyStickerIntoLibrary(stickersDir, sourcePath, prefix = "") {
  if (!sourcePath || !fs.existsSync(sourcePath) || !isStickerFile(sourcePath)) return;
  const meta = migrateLegacyStickers(stickersDir);
  const displayName = sanitizeStickerName(`${prefix ? `${prefix}_` : ""}${path.parse(sourcePath).name}`);
  const record = createStickerRecord(stickersDir, sourcePath, displayName);
  writeStickerMeta(stickersDir, {
    order: [...meta.order, record.id],
    items: [...meta.items, record],
  });
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

function updateStickerMeta(stickersDir, updater) {
  const meta = migrateLegacyStickers(stickersDir);
  const nextMeta = updater({ order: meta.order.slice(), items: meta.items.map((item) => ({ ...item })) }) || meta;
  writeStickerMeta(stickersDir, nextMeta);
  return listStickerEntries(stickersDir);
}

function renameStickerEntry(stickersDir, stickerId, nextName) {
  const targetId = String(stickerId || "").trim();
  const targetName = sanitizeStickerName(nextName);
  if (!targetId || !targetName) return listStickerEntries(stickersDir);
  return updateStickerMeta(stickersDir, (meta) => ({
    ...meta,
    items: meta.items.map((item) => (item.id === targetId ? { ...item, name: targetName, updatedAt: new Date().toISOString() } : item)),
  }));
}

function deleteStickerEntry(stickersDir, stickerId) {
  const targetId = String(stickerId || "").trim();
  if (!targetId) return listStickerEntries(stickersDir);
  const meta = migrateLegacyStickers(stickersDir);
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  const target = meta.items.find((item) => item.id === targetId);
  if (target) {
    [path.join(oriDir, target.originalFileName), path.join(thumbDir, target.thumbFileName)]
      .filter((filePath) => fs.existsSync(filePath))
      .forEach((filePath) => fs.unlinkSync(filePath));
  }
  return updateStickerMeta(stickersDir, (nextMeta) => ({
    order: nextMeta.order.filter((id) => id !== targetId),
    items: nextMeta.items.filter((item) => item.id !== targetId),
  }));
}

function moveStickerEntry(stickersDir, stickerId, direction = 0) {
  const targetId = String(stickerId || "").trim();
  if (!targetId) return listStickerEntries(stickersDir);
  return updateStickerMeta(stickersDir, (meta) => {
    const fromIndex = meta.order.indexOf(targetId);
    const toIndex = fromIndex + Number(direction || 0);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= meta.order.length) return meta;
    const nextOrder = meta.order.slice();
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    return { ...meta, order: nextOrder };
  });
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
