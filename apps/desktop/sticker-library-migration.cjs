const fs = require("node:fs");
const path = require("node:path");
const { createStickerRecord } = require("./sticker-library-records.cjs");
const {
  collectLegacyStickerFiles,
  normalizeStickerMeta,
  writeStickerMeta,
} = require("./sticker-library-meta.cjs");

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

module.exports = {
  migrateLegacyStickers,
};
