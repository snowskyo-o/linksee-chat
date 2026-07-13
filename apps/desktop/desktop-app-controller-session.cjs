function createDesktopAppSessionController(deps) {
  const {
    app,
    closeAllChatWindows,
    createLoginWindow,
    destroyTray,
    quitWindows,
    setTray,
    state,
  } = deps;

  function markAppQuitting() {
    state.isQuitting = true;
  }

  function quitDesktopApp() {
    if (state.isQuitting) return;
    state.isQuitting = true;
    setTray(destroyTray(state.getTray()));
    quitWindows();
    app.quit();
  }

  function logout() {
    const listWindow = state.getListWindow();
    if (listWindow && !listWindow.isDestroyed()) {
      listWindow.destroy();
      state.setListWindow(null);
    }
    closeAllChatWindows();
    createLoginWindow();
  }

  function handleBeforeQuit() {
    state.isQuitting = true;
    setTray(destroyTray(state.getTray()));
  }

  function handleWillQuit() {
    state.clearWindows();
  }

  return {
    handleBeforeQuit,
    handleWillQuit,
    logout,
    markAppQuitting,
    quitDesktopApp,
  };
}

module.exports = {
  createDesktopAppSessionController,
};
