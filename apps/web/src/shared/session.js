import { chatApi } from "./api-client.js";

export function getAuth() {
  return {
    userId: localStorage.getItem("chat_user_id") || "",
    token: localStorage.getItem("chat_access_token") || "",
    role: localStorage.getItem("chat_role") || "",
  };
}

export function requireAuth() {
  if (!getAuth().token) {
    window.location.href = "/login";
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
  window.location.href = "/login";
}

export function bindSessionExpiredRedirect() {
  window.addEventListener("chat:session-expired", () => {
    chatApi.clearSession();
    window.location.href = "/login";
  });
}
