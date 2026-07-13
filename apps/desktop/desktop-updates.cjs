function createDesktopUpdateController({ autoUpdater, getLiveWindows }) {
  let updateState = {
    status: "idle",
    available: false,
    downloaded: false,
    progress: 0,
    version: "",
    error: "",
  };

  function publishUpdateState(patch = {}) {
    updateState = { ...updateState, ...patch };
    getLiveWindows().forEach((window) => {
      window.webContents.send("desktop:update-state", updateState);
    });
    return updateState;
  }

  function registerAutoUpdaterEvents() {
    autoUpdater.on("checking-for-update", () => {
      publishUpdateState({ status: "checking", error: "" });
    });
    autoUpdater.on("update-available", (info) => {
      publishUpdateState({
        status: "available",
        available: true,
        downloaded: false,
        progress: 0,
        version: info?.version || "",
        error: "",
      });
    });
    autoUpdater.on("update-not-available", () => {
      publishUpdateState({
        status: "none",
        available: false,
        downloaded: false,
        progress: 0,
        version: "",
        error: "",
      });
    });
    autoUpdater.on("download-progress", (progress) => {
      publishUpdateState({
        status: "downloading",
        available: true,
        progress: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
        error: "",
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      publishUpdateState({
        status: "downloaded",
        available: true,
        downloaded: true,
        progress: 100,
        version: info?.version || updateState.version || "",
        error: "",
      });
    });
    autoUpdater.on("error", (error) => {
      publishUpdateState({
        status: "error",
        error: error?.message || "更新失败",
      });
    });
  }

  return {
    publishUpdateState,
    registerAutoUpdaterEvents,
    updateStateRef: () => updateState,
  };
}

module.exports = {
  createDesktopUpdateController,
};
