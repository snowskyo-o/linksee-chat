import { rawRequest, UNAUTH_CODE } from "./api-client-base.js";

let refreshPromise = null;

export function clearSession() {
  ["chat_access_token", "chat_refresh_token", "chat_user_id", "chat_role"].forEach((key) => {
    localStorage.removeItem(key);
  });
}

function dispatchSessionExpired(message) {
  window.dispatchEvent(new CustomEvent("chat:session-expired", {
    detail: { code: UNAUTH_CODE, message: message || "登录状态已失效，请重新登录" },
  }));
}

export function authHeaders(extraHeaders) {
  const headers = Object.assign({}, extraHeaders || {});
  const token = localStorage.getItem("chat_access_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem("chat_refresh_token");
    if (!refreshToken) {
      clearSession();
      dispatchSessionExpired("登录状态已失效，请重新登录");
      throw new Error("登录状态已失效，请重新登录");
    }

    const result = await rawRequest("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!result.response.ok || (result.payload && result.payload.ok === false)) {
      const message = result.payload?.message || "登录状态已失效，请重新登录";
      clearSession();
      dispatchSessionExpired(message);
      throw new Error(message);
    }

    const data = result.payload?.data || {};
    if (data.accessToken) localStorage.setItem("chat_access_token", data.accessToken);
    if (data.refreshToken) localStorage.setItem("chat_refresh_token", data.refreshToken);
    if (data.userId) localStorage.setItem("chat_user_id", data.userId);
    if (data.role) localStorage.setItem("chat_role", data.role);
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export function buildApiError(response, payload) {
  const error = new Error(payload?.message || "请求失败");
  error.code = payload?.code || "";
  if (error.code === UNAUTH_CODE || response.status === 401) {
    clearSession();
    dispatchSessionExpired(error.message || "登录状态已失效，请重新登录");
  }
  return error;
}
