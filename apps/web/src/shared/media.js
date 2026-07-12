import { getServerOrigin } from "./runtime.js";

export function resolveMediaUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^(https?:|data:|blob:|file:)/i.test(source)) return source;
  if (source.startsWith("/")) return `${getServerOrigin()}${source}`;
  return source;
}

export function appendCacheBust(url, version = Date.now()) {
  const source = String(url || "").trim();
  if (!source) return "";
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}v=${encodeURIComponent(String(version))}`;
}
