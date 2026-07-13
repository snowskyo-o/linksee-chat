import { buildNetworkError, buildUrl } from "./api-client-base.js";
import { authHeaders, buildApiError } from "./api-client-session.js";

function buildProgressPayload(event) {
  return {
    loaded: event.loaded,
    total: event.total,
    percent: Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))),
  };
}

export function requestBlobWithProgress(path, headers = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", buildUrl(path), true);
    xhr.responseType = "blob";
    Object.entries(authHeaders(headers)).forEach(([key, value]) => {
      if (value != null) xhr.setRequestHeader(key, value);
    });
    xhr.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") return;
      onProgress(buildProgressPayload(event));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
        return;
      }
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {}
      reject(buildApiError({ status: xhr.status }, payload));
    };
    xhr.onerror = () => reject(buildNetworkError(new Error("XMLHttpRequest failed")));
    xhr.send();
  });
}

export function putExternal(url, body, headers = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value != null) xhr.setRequestHeader(key, value);
    });
    if (typeof onProgress === "function") {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(buildProgressPayload(event));
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
