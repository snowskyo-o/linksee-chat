const { createDesktopMainRuntime } = require("./desktop-main-runtime.cjs");
const { createDesktopMainState } = require("./desktop-main-state.cjs");

function createDesktopMainContext({
  __dirname,
  buildWindowState,
  createScreenshotSelectionManager,
  processEnv,
  processExecPath,
  processResourcesPath,
}) {
  const runtime = createDesktopMainRuntime({
    __dirname,
    processEnv,
    processExecPath,
    processResourcesPath,
  });
  const state = createDesktopMainState({
    buildWindowState,
    createScreenshotSelectionManager,
    runtime,
  });
  return {
    ...runtime,
    ...state,
  };
}

module.exports = {
  createDesktopMainContext,
};
