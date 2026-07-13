import { fetchBlobResponse, getApiBaseUrl, rawRequest } from "./api-client-base.js";
import {
  authHeaders,
  buildApiError,
  clearSession,
  refreshAccessToken,
} from "./api-client-session.js";
import { putExternal, requestBlobWithProgress } from "./api-client-xhr.js";

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
  let response = await fetchBlobResponse(path, options);

  if (response.status === 401 && path !== "/api/v1/auth/refresh") {
    await refreshAccessToken();
    response = await fetchBlobResponse(path, Object.assign({}, options || {}, {
      headers: authHeaders(options && options.headers ? options.headers : {}),
    }));
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw buildApiError(response, payload);
  }

  return response;
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
  async getBlob(path) {
    const response = await requestBlob(path, { headers: authHeaders() });
    return response.blob();
  },
  getBlobWithProgress(path, onProgress) {
    return requestBlobWithProgress(path, {}, onProgress);
  },
  putExternal,
};
