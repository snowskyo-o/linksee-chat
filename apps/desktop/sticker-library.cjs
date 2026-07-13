const { mapStickerEntries } = require("./sticker-library-records.cjs");
const { normalizeStickerMeta, writeStickerMeta } = require("./sticker-library-meta.cjs");
const { migrateLegacyStickers } = require("./sticker-library-migration.cjs");
const {
  copyStickerIntoLibrary: copyStickerIntoLibraryEntry,
  deleteStickerEntry: deleteStickerEntryEntry,
  moveStickerEntry: moveStickerEntryEntry,
  renameStickerEntry: renameStickerEntryEntry,
} = require("./sticker-library-mutations.cjs");
const {
  STICKER_EXTENSIONS,
  walkStickerFiles,
} = require("./sticker-library-utils.cjs");

function listStickerEntries(stickersDir) {
  return mapStickerEntries(stickersDir, migrateLegacyStickers(stickersDir));
}

function copyStickerIntoLibrary(stickersDir, sourcePath, prefix = "") {
  copyStickerIntoLibraryEntry(stickersDir, writeStickerMeta, sourcePath, prefix);
}

function renameStickerEntry(stickersDir, stickerId, nextName) {
  return renameStickerEntryEntry(stickersDir, listStickerEntries, writeStickerMeta, stickerId, nextName);
}

function deleteStickerEntry(stickersDir, stickerId) {
  return deleteStickerEntryEntry(stickersDir, listStickerEntries, writeStickerMeta, stickerId);
}

function moveStickerEntry(stickersDir, stickerId, direction = 0) {
  return moveStickerEntryEntry(stickersDir, listStickerEntries, writeStickerMeta, stickerId, direction);
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
