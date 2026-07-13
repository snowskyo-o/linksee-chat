const fs = require("node:fs");
const path = require("node:path");
const { createStickerRecord, mapStickerEntries } = require("./sticker-library-records.cjs");
const {
  collectLegacyStickerFiles,
  normalizeStickerMeta,
  writeStickerMeta,
} = require("./sticker-library-meta.cjs");
const {
  STICKER_EXTENSIONS,
  ensureLibraryDirs,
  isStickerFile,
  sanitizeStickerName,
  walkStickerFiles,
} = require("./sticker-library-utils.cjs");

function migrateLegacyStickers(stickersDir) {
  const meta = normalizeStickerMeta(stickersDir);
  const legacyFiles = collectLegacyStickerFiles(stickersDir, meta);
  if (!legacyFiles.length) return meta;
  const nextItems = meta.items.slice();
  const nextOrder = meta.order.slice();
  legacyFiles.forEach(({ filePath, movedPath }) => {
    const record = createStickerRecord(stickersDir, filePath, path.parse(filePath).name);
    nextItems.push(record);
    nextOrder.push(record.id);
    if (fs.existsSync(filePath) && path.resolve(filePath) !== path.resolve(movedPath)) fs.unlinkSync(filePath);
  });
  writeStickerMeta(stickersDir, { order: nextOrder, items: nextItems });
  return normalizeStickerMeta(stickersDir);
}

function listStickerEntries(stickersDir) {
  return mapStickerEntries(stickersDir, migrateLegacyStickers(stickersDir));
}

function withUpdatedMeta(stickersDir, updater) {
  const meta = migrateLegacyStickers(stickersDir);
  const nextMeta = updater({
    order: meta.order.slice(),
    items: meta.items.map((item) => ({ ...item })),
  }) || meta;
  writeStickerMeta(stickersDir, nextMeta);
  return listStickerEntries(stickersDir);
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

function renameStickerEntry(stickersDir, stickerId, nextName) {
  const targetId = String(stickerId || "").trim();
  const targetName = sanitizeStickerName(nextName);
  if (!targetId || !targetName) return listStickerEntries(stickersDir);
  return withUpdatedMeta(stickersDir, (meta) => ({
    ...meta,
    items: meta.items.map((item) => (
      item.id === targetId
        ? { ...item, name: targetName, updatedAt: new Date().toISOString() }
        : item
    )),
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
  return withUpdatedMeta(stickersDir, (nextMeta) => ({
    order: nextMeta.order.filter((id) => id !== targetId),
    items: nextMeta.items.filter((item) => item.id !== targetId),
  }));
}

function moveStickerEntry(stickersDir, stickerId, direction = 0) {
  const targetId = String(stickerId || "").trim();
  if (!targetId) return listStickerEntries(stickersDir);
  return withUpdatedMeta(stickersDir, (meta) => {
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
  copyStickerIntoLibrary,
  deleteStickerEntry,
  listStickerEntries,
  moveStickerEntry,
  renameStickerEntry,
  walkStickerFiles,
};
