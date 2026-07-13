const fs = require("node:fs");
const path = require("node:path");
const { nativeImage } = require("electron");
const {
  createDataUrl,
  createStickerId,
  ensureLibraryDirs,
  isAnimatedStickerExtension,
  sanitizeStickerName,
} = require("./sticker-library-utils.cjs");

function resolveThumbBuffer(sourcePath) {
  const image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) return fs.readFileSync(sourcePath);
  return image.resize({ width: 96, height: 96, quality: "good" }).toPNG();
}

function createStickerRecord(stickersDir, sourcePath, suggestedName = "") {
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  const parsed = path.parse(sourcePath);
  const extension = parsed.ext.toLowerCase();
  const displayName = sanitizeStickerName(suggestedName || parsed.name);
  const id = createStickerId(displayName);
  const originalFileName = `${id}${extension}`;
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
    isAnimated: isAnimatedStickerExtension(extension),
    size: fs.statSync(originalPath).size,
    updatedAt: new Date().toISOString(),
  };
}

function mapStickerEntries(stickersDir, meta) {
  const { oriDir, thumbDir } = ensureLibraryDirs(stickersDir);
  return meta.order
    .map((id) => meta.items.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      name: item.name,
      fileName: item.originalFileName,
      size: Number(item.size || 0),
      updatedAt: item.updatedAt || "",
      isAnimated: Boolean(item.isAnimated),
      src: createDataUrl(path.join(thumbDir, item.thumbFileName)),
      previewSrc: item.isAnimated
        ? createDataUrl(path.join(oriDir, item.originalFileName))
        : createDataUrl(path.join(thumbDir, item.thumbFileName)),
      originalSrc: createDataUrl(path.join(oriDir, item.originalFileName)),
    }));
}

module.exports = {
  createStickerRecord,
  mapStickerEntries,
};
