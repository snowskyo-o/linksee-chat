export function isDesktopRuntime() {
  return Boolean(window.desktopShell?.isDesktop) || window.location.protocol === "file:";
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function getServerOrigin() {
  const desktopOrigin = normalizeOrigin(window.desktopShell?.serverOrigin);
  if (desktopOrigin) return desktopOrigin;

  const runtimeOrigin = window.location.origin && window.location.origin !== "null"
    ? normalizeOrigin(window.location.origin)
    : "";

  return runtimeOrigin || "http://localhost:3010";
}

export function resolveAppPage(page) {
  if (isDesktopRuntime()) {
    const filename = page === "chat" ? "chat.html" : "login.html";
    return new URL(`./${filename}`, window.location.href).toString();
  }

  return page === "chat" ? "/chat" : "/login";
}

export function navigateTo(page) {
  window.location.href = resolveAppPage(page);
}
