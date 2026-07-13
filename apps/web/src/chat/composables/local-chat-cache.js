function isDesktopCacheAvailable() {
  return Boolean(window.desktopShell?.isDesktop)
    && typeof window.desktopShell?.readStateCache === "function"
    && typeof window.desktopShell?.writeStateCache === "function";
}

function buildScope(userId) {
  return `user-${String(userId || "guest").trim() || "guest"}`;
}

export async function readChatCache(userId, key) {
  if (!isDesktopCacheAvailable() || !key) return null;
  return window.desktopShell.readStateCache({
    scope: buildScope(userId),
    key,
  }).catch(() => null);
}

export async function writeChatCache(userId, key, data) {
  if (!isDesktopCacheAvailable() || !key) return false;
  return window.desktopShell.writeStateCache({
    scope: buildScope(userId),
    key,
    data,
  }).catch(() => false);
}
