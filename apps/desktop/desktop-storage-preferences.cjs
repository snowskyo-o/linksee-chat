const fs = require("node:fs");
const { getDefaultDesktopPreferences, getDesktopPreferencesPath } = require("./desktop-storage-paths.cjs");

let desktopPreferences = null;

function loadDesktopPreferences() {
  const defaults = getDefaultDesktopPreferences();
  try {
    const filePath = getDesktopPreferencesPath();
    if (!fs.existsSync(filePath)) return defaults;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      downloadsDir: String(parsed?.downloadsDir || defaults.downloadsDir).trim() || defaults.downloadsDir,
      launchOnStartup: Boolean(parsed?.launchOnStartup),
      notificationsMuted: Boolean(parsed?.notificationsMuted),
      closeToTray: parsed?.closeToTray !== false,
    };
  } catch {
    return defaults;
  }
}

function getDesktopPreferences() {
  if (!desktopPreferences) desktopPreferences = loadDesktopPreferences();
  return desktopPreferences;
}

function writeDesktopPreferences(nextPreferences) {
  desktopPreferences = { ...getDefaultDesktopPreferences(), ...(nextPreferences || {}) };
  fs.writeFileSync(getDesktopPreferencesPath(), JSON.stringify(desktopPreferences, null, 2), "utf8");
  return desktopPreferences;
}

module.exports = {
  getDesktopPreferences,
  loadDesktopPreferences,
  writeDesktopPreferences,
};
