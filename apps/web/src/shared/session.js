import { chatApi } from "./api-client.js";
import { getDesktopWindowKind, isDesktopRuntime, navigateTo } from "./runtime.js";

export function getAuth() {
  return {
    userId: localStorage.getItem("chat_user_id") || "",
    token: localStorage.getItem("chat_access_token") || "",
    role: localStorage.getItem("chat_role") || "",
  };
}

export function requireAuth() {
  if (!getAuth().token) {
    if (
      isDesktopRuntime()
      && getDesktopWindowKind() !== "login"
      && typeof window.desktopShell?.logoutToLogin === "function"
    ) {
      window.desktopShell.logoutToLogin();
      return false;
    }
    navigateTo("login");
    return false;
  }
  return true;
}

export function logout() {
  const refreshToken = localStorage.getItem("chat_refresh_token") || "";
  if (refreshToken) {
    fetch(chatApi.getApiBaseUrl() + "/api/v1/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  chatApi.clearSession();
  if (isDesktopRuntime() && typeof window.desktopShell?.logoutToLogin === "function") {
    window.desktopShell.logoutToLogin();
    return;
  }
  navigateTo("login");
}

export function bindSessionExpiredRedirect() {
  window.addEventListener("chat:session-expired", () => {
    chatApi.clearSession();
    if (isDesktopRuntime() && typeof window.desktopShell?.logoutToLogin === "function") {
      window.desktopShell.logoutToLogin();
      return;
    }
    navigateTo("login");
  });
}
