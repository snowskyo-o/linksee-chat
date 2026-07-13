function resolveWindowByEvent(BrowserWindow, event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function buildWindowState(window) {
  return !window || window.isDestroyed() ? { isMaximized: false } : { isMaximized: window.isMaximized() };
}

function toggleWindowMaximize(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
}

function focusWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function snapshotWindowBounds(window) {
  if (!window || window.isDestroyed()) return null;
  const bounds = window.getBounds();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function animateWindowBounds(window, fromBounds, toBounds, { duration = 180, onDone } = {}) {
  if (!window || window.isDestroyed()) {
    if (typeof onDone === "function") onDone();
    return;
  }
  const start = Date.now();
  const tick = () => {
    if (!window || window.isDestroyed()) {
      if (typeof onDone === "function") onDone();
      return;
    }
    const elapsed = Date.now() - start;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextBounds = {
      x: Math.round(fromBounds.x + ((toBounds.x - fromBounds.x) * eased)),
      y: Math.round(fromBounds.y + ((toBounds.y - fromBounds.y) * eased)),
      width: Math.round(fromBounds.width + ((toBounds.width - fromBounds.width) * eased)),
      height: Math.round(fromBounds.height + ((toBounds.height - fromBounds.height) * eased)),
    };

    window.setBounds(nextBounds, false);
    if (progress >= 1) {
      if (typeof onDone === "function") onDone();
      return;
    }
    setTimeout(tick, 12);
  };
  tick();
}

function setWindowContext(windowContextById, window, context = {}) {
  if (!window || window.isDestroyed()) return;
  const existing = windowContextById.get(window.id) || {};
  const nextContext = {
    ...existing,
    kind: String(context.kind || existing.kind || "").trim(),
    conversationId: String(context.conversationId || existing.conversationId || "").trim(),
    title: String(context.title || existing.title || "").trim(),
  };
  windowContextById.set(window.id, nextContext);
  const windowTitle = nextContext.title || window.getTitle?.() || "Linksee Chat";
  if (windowTitle && typeof window.setTitle === "function") window.setTitle(windowTitle);
}

function clearWindowContext(windowContextById, window) {
  if (!window) return;
  windowContextById.delete(window.id);
}
function shouldSuppressDesktopNotification(BrowserWindow, windowContextById, conversationId) {
  const targetConversationId = String(conversationId || "").trim();
  if (!targetConversationId) return false;
  for (const [windowId, context] of windowContextById.entries()) {
    const currentWindow = BrowserWindow.fromId(windowId);
    if (!currentWindow || currentWindow.isDestroyed() || currentWindow.isMinimized() || !currentWindow.isVisible()) continue;
    if (!currentWindow.isFocused()) continue;
    if (String(context?.conversationId || "").trim() === targetConversationId) return true;
  }
  return false;
}

module.exports = {
  animateWindowBounds,
  buildWindowState,
  clearWindowContext,
  focusWindow,
  resolveWindowByEvent,
  setWindowContext,
  shouldSuppressDesktopNotification,
  snapshotWindowBounds,
  toggleWindowMaximize,
};
