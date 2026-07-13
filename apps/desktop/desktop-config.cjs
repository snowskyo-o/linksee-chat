const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_REMOTE_ORIGIN = "http://186.241.89.102";

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function buildDesktopRuntimeConfig({ projectRoot, processEnv, processResourcesPath, processExecPath, port }) {
  const configCandidates = [
    path.join(projectRoot, "desktop-config.json"),
    path.join(processResourcesPath || "", "desktop-config.json"),
    path.join(path.dirname(processExecPath), "desktop-config.json"),
  ];

  function readDesktopConfigValue(key) {
    for (const file of configCandidates) {
      try {
        if (!file || !fs.existsSync(file)) continue;
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        const value = normalizeOrigin(parsed?.[key]);
        if (value) return value;
      } catch (error) {
        console.error(`[desktop] failed to read config ${file}`, error);
      }
    }
    return "";
  }

  const remoteOrigin = normalizeOrigin(processEnv.DESKTOP_REMOTE_ORIGIN)
    || readDesktopConfigValue("remoteOrigin")
    || DEFAULT_REMOTE_ORIGIN;
  const localOrigin = `http://127.0.0.1:${port}`;

  return {
    localOrigin,
    remoteOrigin,
    targetOrigin: remoteOrigin || localOrigin,
    updateFeedUrl: normalizeOrigin(processEnv.DESKTOP_UPDATE_FEED_URL)
      || readDesktopConfigValue("updateFeedUrl")
      || `${remoteOrigin}/updates/desktop/win/stable`,
  };
}

module.exports = {
  buildDesktopRuntimeConfig,
};
