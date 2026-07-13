const { createDesktopShellWindow } = require("./desktop-window-shell.cjs");

function createChatDesktopWindows({ clearWindowContext, setWindowContext, state, windowDeps }) {
  function createChatWindow(conversationId) {
    const key = String(conversationId || "").trim();
    if (!key) return null;
    const existing = state.chatWindows.get(key);
    if (existing && !existing.isDestroyed()) {
      windowDeps.focusWindow(existing);
      return existing;
    }
    const chatWindow = createDesktopShellWindow(windowDeps, {
      width: 1100,
      height: 820,
      minWidth: 820,
      minHeight: 620,
      title: "Linksee Chat Conversation",
      backgroundColor: "#f3f6fb",
      pagePath: windowDeps.chatPagePath,
      pageQuery: { conversationId: key, mode: "conversation" },
      kind: "chat",
      conversationId: key,
    });
    setWindowContext(chatWindow, { kind: "chat", conversationId: key });
    chatWindow.on("closed", () => {
      clearWindowContext(chatWindow);
      state.chatWindows.delete(key);
    });
    state.chatWindows.set(key, chatWindow);
    return chatWindow;
  }

  function closeAllChatWindows() {
    for (const window of state.chatWindows.values()) {
      if (window && !window.isDestroyed()) window.close();
    }
    state.chatWindows.clear();
  }

  return {
    closeAllChatWindows,
    createChatWindow,
  };
}

module.exports = {
  createChatDesktopWindows,
};
