import { getServerOrigin } from "./runtime.js";

export function resolveMediaUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^(https?:|data:|blob:|file:)/i.test(source)) return source;
  if (source.startsWith("/")) return `${getServerOrigin()}${source}`;
  return source;
}
