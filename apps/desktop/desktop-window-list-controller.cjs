const { animateWindowBounds, snapshotWindowBounds } = require("./desktop-window-utils.cjs");

function createDesktopListWindowController(state) {
  function slideOutListWindow() {
    const listWindow = state.listWindow;
    if (!listWindow || listWindow.isDestroyed() || state.listWindowAnimating || !listWindow.isVisible()) return;

    state.listWindowAnimating = true;
    state.listWindowBoundsSnapshot = snapshotWindowBounds(listWindow) || state.listWindowBoundsSnapshot;
    const fromBounds = snapshotWindowBounds(listWindow);
    if (!fromBounds) {
      state.listWindowAnimating = false;
      return;
    }

    animateWindowBounds(listWindow, fromBounds, {
      ...fromBounds,
      x: fromBounds.x + Math.round(fromBounds.width * 0.72),
    }, {
      duration: 180,
      onDone: () => {
        if (state.listWindow && !state.listWindow.isDestroyed()) {
          state.listWindow.hide();
          if (state.listWindowBoundsSnapshot) {
            state.listWindow.setBounds(state.listWindowBoundsSnapshot, false);
          }
        }
        state.listWindowAnimating = false;
      },
    });
  }

  function restoreListWindowPosition() {
    const listWindow = state.listWindow;
    if (!listWindow || listWindow.isDestroyed()) return;
    if (!state.listWindowBoundsSnapshot) {
      state.listWindowBoundsSnapshot = snapshotWindowBounds(listWindow);
      return;
    }
    listWindow.setBounds(state.listWindowBoundsSnapshot, false);
  }

  function bindListWindowMoveTracking() {
    state.listWindow.on("move", () => {
      if (state.listWindowAnimating || !state.listWindow || state.listWindow.isDestroyed() || !state.listWindow.isVisible()) return;
      state.listWindowBoundsSnapshot = snapshotWindowBounds(state.listWindow);
    });
  }

  return {
    bindListWindowMoveTracking,
    restoreListWindowPosition,
    slideOutListWindow,
  };
}

module.exports = {
  createDesktopListWindowController,
};
