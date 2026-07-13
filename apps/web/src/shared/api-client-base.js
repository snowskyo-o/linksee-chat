import { getServerOrigin } from "./runtime.js";

export const UNAUTH_CODE = "UNAUTHENTICATED";
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";

export function getApiBaseUrl() {
  return getServerOrigin();
}

export function buildUrl(path) {
  return getApiBaseUrl() + path;
}

export function buildNetworkError(error) {
  const nextError = new Error("网络不可用或服务器未启动，请检查连接后重试");
  nextError.code = NETWORK_ERROR_CODE;
  nextError.cause = error;
  return nextError;
}

export async function rawRequest(path, options) {
  let response;
  try {
    response = await fetch(buildUrl(path), options);
  } catch (error) {
    throw buildNetworkError(error);
  }
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function fetchBlobResponse(path, options) {
  try {
    return await fetch(buildUrl(path), options);
  } catch (error) {
    throw buildNetworkError(error);
  }
}
