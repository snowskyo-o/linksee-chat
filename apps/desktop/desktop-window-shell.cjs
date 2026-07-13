function createDesktopShellWindow(deps, options) {
  const {
    BrowserWindow,
    buildArguments,
    preloadPath,
    sendWindowState,
  } = deps;
  const {
    width,
    height,
    minWidth,
    minHeight,
    transparent = false,
    resizable = true,
    maximizable = true,
    fullscreenable = true,
    title = "Linksee Chat",
    backgroundColor = "#f4f7fb",
    pagePath,
    pageQuery = {},
    kind,
    conversationId = "",
  } = options;

  const window = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    transparent,
    hasShadow: true,
    resizable,
    maximizable,
    fullscreenable,
    autoHideMenuBar: true,
    frame: false,
    title,
    backgroundColor,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: buildArguments({ kind, conversationId }),
    },
  });

  window.on("maximize", () => sendWindowState(window));
  window.on("unmaximize", () => sendWindowState(window));
  window.on("enter-full-screen", () => sendWindowState(window));
  window.on("leave-full-screen", () => sendWindowState(window));
  window.once("ready-to-show", () => sendWindowState(window));
  window.loadFile(pagePath, { query: pageQuery }).catch((error) => {
    console.error("[desktop] failed to load renderer", error);
  });
  return window;
}

module.exports = {
  createDesktopShellWindow,
};
