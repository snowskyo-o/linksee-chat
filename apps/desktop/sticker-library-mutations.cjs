const fs = require("node:fs");
const path = require("node:path");
const { createStickerRecord } = require("./sticker-library-records.cjs");
const { ensureLibraryDirs, isStickerFile, sanitizeStickerName } = require("./sticker-library-utils.cjs");
const { migrateLegacyStickers } = require("./sticker-library-migration.cjs");

function withUpdatedMeta(stickersDir, listStickerEntries, writeStickerMeta, updater) {
  const meta = migrateLegacyStickers(stickersDir);
  const nextMeta = updater({
    order: meta.order.slice(),
    items: meta.items.map((item) => ({ ...item })),
  }) || meta;
  writeStickerMeta(stickersDir, nextMeta);
  return listStickerEntries(stickersDir);
}

function copyStickerIntoLibrary(stickersDir, writeStickerMeta, sourcePath, prefix = "") {
  if (!sourcePath || !fs.existsSync(sourcePath) || !isStickerFile(sourcePath)) return;
  const meta = migrateLegacyStickers(stickersDir);
  const displayName = sanitizeStickerName(`${prefix ? `${prefix}_` : ""}${path.parse(sourcePath).name}`);
  const record = createStickerRecord(stickersDir, sourcePath, displayName);
  writeStickerMeta(stickersDir, {
    order: [...meta.order, record.id],
    items: [...meta.items, record],
  });
}

function renameStickerEntry(stickersDir, listStickerEntries, writeStickerMeta, stickerId, nextName) {
  const targetId = String(stickerId || "").trim();
  const targetName = sanitizeStickerName(nextName);
  if (!targetId || !targetName) return listStickerEntries(stickersDir);
  return withUpdatedMeta(stickersDir, listStickerEntries, writeStickerMeta, (meta) => ({
    ...meta,
    items: meta.items.map((item) => (
      item.id === targetId
        ? { ...item, name: targetName, updatedAt: new Date().toISOString() }
        : item
    )),
  }));
}

function deleteStickerEntry(stickersDir, listStickerEntries, writeStickerMeta, stickerId) {
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
  return withUpdatedMeta(stickersDir, listStickerEntries, writeStickerMeta, (nextMeta) => ({
    order: nextMeta.order.filter((id) => id !== targetId),
    items: nextMeta.items.filter((item) => item.id !== targetId),
  }));
}

function moveStickerEntry(stickersDir, listStickerEntries, writeStickerMeta, stickerId, direction = 0) {
  const targetId = String(stickerId || "").trim();
  if (!targetId) return listStickerEntries(stickersDir);
  return withUpdatedMeta(stickersDir, listStickerEntries, writeStickerMeta, (meta) => {
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
  copyStickerIntoLibrary,
  deleteStickerEntry,
  moveStickerEntry,
  renameStickerEntry,
};
