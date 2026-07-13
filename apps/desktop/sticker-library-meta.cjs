const fs = require("node:fs");
const path = require("node:path");
const { ensureLibraryDirs, isStickerFile } = require("./sticker-library-utils.cjs");

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
  fs.writeFileSync(metaPath, JSON.stringify({
    order: Array.isArray(meta.order) ? meta.order : [],
    items: Array.isArray(meta.items) ? meta.items : [],
  }, null, 2), "utf8");
}

function normalizeStickerMeta(stickersDir) {
  const meta = readStickerMeta(stickersDir);
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  const items = meta.items.filter((item) => (
    item?.id && item?.originalFileName && item?.thumbFileName
    && fs.existsSync(path.join(oriDir, item.originalFileName))
    && fs.existsSync(path.join(thumbDir, item.thumbFileName))
  ));
  const order = [...new Set([...meta.order.filter((id) => items.some((item) => item.id === id)), ...items.map((item) => item.id)])];
  writeStickerMeta(stickersDir, { order, items });
  return { order, items };
}

function collectLegacyStickerFiles(stickersDir, meta) {
  const { oriDir } = ensureLibraryDirs(stickersDir);
  const knownOriginals = new Set(meta.items.map((item) => item.originalFileName));
  return fs.readdirSync(stickersDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isStickerFile(entry.name) && !knownOriginals.has(entry.name))
    .map((entry) => ({
      filePath: path.join(stickersDir, entry.name),
      movedPath: path.join(oriDir, entry.name),
    }));
}

module.exports = {
  collectLegacyStickerFiles,
  normalizeStickerMeta,
  readStickerMeta,
  writeStickerMeta,
};
