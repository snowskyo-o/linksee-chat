import { getServerOrigin } from "./runtime.js";

const UNAUTH_CODE = "UNAUTHENTICATED";
const NETWORK_ERROR_CODE = "NETWORK_ERROR";
let refreshPromise = null;

export function getApiBaseUrl() {
  return getServerOrigin();
}

function buildUrl(path) {
  return getApiBaseUrl() + path;
}

function buildNetworkError(error) {
  const nextError = new Error("网络不可用或服务器未启动，请检查连接后重试");
  nextError.code = NETWORK_ERROR_CODE;
  nextError.cause = error;
  return nextError;
}

async function rawRequest(path, options) {
  let response;
  try {
    response = await fetch(buildUrl(path), options);
  } catch (error) {
    throw buildNetworkError(error);
  }
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

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

function authHeaders(extraHeaders) {
  const headers = Object.assign({}, extraHeaders || {});
  const token = localStorage.getItem("chat_access_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function refreshAccessToken() {
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
      clearSession();
      dispatchSessionExpired(result.payload && result.payload.message ? result.payload.message : "登录状态已失效，请重新登录");
      throw new Error(result.payload && result.payload.message ? result.payload.message : "登录状态已失效，请重新登录");
    }

    const data = result.payload && result.payload.data ? result.payload.data : {};
    if (data.accessToken) localStorage.setItem("chat_access_token", data.accessToken);
    if (data.refreshToken) localStorage.setItem("chat_refresh_token", data.refreshToken);
    if (data.role) localStorage.setItem("chat_role", data.role);
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function buildApiError(response, payload) {
  const error = new Error(payload && payload.message ? payload.message : "请求失败");
  error.code = payload && payload.code ? payload.code : "";
  if (error.code === UNAUTH_CODE || response.status === 401) {
    clearSession();
    dispatchSessionExpired(error.message || "登录状态已失效，请重新登录");
  }
  return error;
}

export async function request(path, options) {
  let result = await rawRequest(path, options);
  let { response, payload } = result;

  if (response.status === 401 && path !== "/api/v1/auth/refresh") {
    await refreshAccessToken();
    result = await rawRequest(path, Object.assign({}, options || {}, {
      headers: authHeaders(options && options.headers ? options.headers : {}),
    }));
    response = result.response;
    payload = result.payload;
  }

  if (!response.ok || (payload && payload.ok === false)) {
    throw buildApiError(response, payload);
  }

  return payload;
}

async function requestBlob(path, options) {
  let response;
  try {
    response = await fetch(buildUrl(path), options);
  } catch (error) {
    throw buildNetworkError(error);
  }

  if (response.status === 401 && path !== "/api/v1/auth/refresh") {
    await refreshAccessToken();
    try {
      response = await fetch(buildUrl(path), Object.assign({}, options || {}, {
        headers: authHeaders(options && options.headers ? options.headers : {}),
      }));
    } catch (error) {
      throw buildNetworkError(error);
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw buildApiError(response, payload);
  }

  return response;
}

function putExternal(url, body, headers = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value != null) xhr.setRequestHeader(key, value);
    });
    if (typeof onProgress === "function") {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))),
        });
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr);
        return;
      }
      reject(new Error(xhr.responseText || "上传失败"));
    };
    xhr.onerror = () => reject(buildNetworkError(new Error("XMLHttpRequest failed")));
    xhr.send(body);
  });
}

export const chatApi = {
  getApiBaseUrl,
  clearSession,
  request,
  getJson(path) {
    return request(path, { headers: authHeaders() });
  },
  postJson(path, body) {
    return request(path, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body || {}),
    });
  },
  patchJson(path, body) {
    return request(path, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body || {}),
    });
  },
  delete(path) {
    return request(path, { method: "DELETE", headers: authHeaders() });
  },
  postBinary(path, file, headers = {}) {
    return request(path, {
      method: "POST",
      headers: authHeaders(headers),
      body: file,
    });
  },
  getBlob(path) {
    return requestBlob(path, { headers: authHeaders() });
  },
  putExternal,
};
