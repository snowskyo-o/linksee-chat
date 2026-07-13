const {
  ensureStorageDirectories,
  getDefaultDesktopPreferences,
  getStorageInfo,
} = require("./desktop-storage-paths.cjs");
const { getDesktopPreferences, writeDesktopPreferences } = require("./desktop-storage-preferences.cjs");
const { readStateCache: readStateCacheBase, writeStateCache: writeStateCacheBase } = require("./desktop-storage-cache.cjs");
const { ensureRemoteAvatarCached: ensureRemoteAvatarCachedBase, saveDownloadedAsset: saveDownloadedAssetBase } = require("./desktop-storage-assets.cjs");

const readStateCache = (scope = "shared", key = "") => readStateCacheBase(getDesktopPreferences, scope, key);
const writeStateCache = (scope = "shared", key = "", data = null) => writeStateCacheBase(getDesktopPreferences, scope, key, data);
const ensureRemoteAvatarCached = (sourceUrl) => ensureRemoteAvatarCachedBase(getDesktopPreferences, sourceUrl);
const saveDownloadedAsset = (payload) => saveDownloadedAssetBase(getDesktopPreferences, payload);

module.exports = {
  ensureRemoteAvatarCached,
  ensureStorageDirectories: () => ensureStorageDirectories(getDesktopPreferences),
  getDefaultDesktopPreferences,
  getDesktopPreferences,
  getStorageInfo: () => getStorageInfo(getDesktopPreferences),
  readStateCache,
  saveDownloadedAsset,
  writeDesktopPreferences,
  writeStateCache,
};
