const path = require("node:path");
const { buildDesktopRuntimeConfig } = require("./desktop-config.cjs");

function createDesktopMainRuntime({ __dirname, processEnv, processExecPath, processResourcesPath }) {
  const projectRoot = path.resolve(__dirname, "../..");
  const port = processEnv.DESKTOP_PORT || processEnv.PORT || "3010";
  const preloadPath = path.join(__dirname, "preload.cjs");
  const screenshotSelectionPreloadPath = path.join(__dirname, "screenshot-selection-preload.cjs");
  const rendererRoot = path.join(projectRoot, "apps", "web", "dist");
  const loginPagePath = path.join(rendererRoot, "login.html");
  const listPagePath = path.join(rendererRoot, "list.html");
  const chatPagePath = path.join(rendererRoot, "chat.html");
  const { targetOrigin, updateFeedUrl } = buildDesktopRuntimeConfig({
    projectRoot,
    processEnv,
    processResourcesPath,
    processExecPath,
    port,
  });

  return {
    chatPagePath,
    listPagePath,
    loginPagePath,
    port,
    preloadPath,
    projectRoot,
    screenshotSelectionPreloadPath,
    targetOrigin,
    updateFeedUrl,
  };
}

module.exports = {
  createDesktopMainRuntime,
};
