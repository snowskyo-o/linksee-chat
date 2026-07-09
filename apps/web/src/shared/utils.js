export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

export function getInitials(name, fallback = "U") {
  const source = String(name || fallback).trim();
  return source.slice(0, 2).toUpperCase();
}

function pad2(value) {
  const num = Number(value) || 0;
  return num < 10 ? `0${num}` : String(num);
}

export function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return [
    date.getFullYear(),
    "-",
    pad2(date.getMonth() + 1),
    "-",
    pad2(date.getDate()),
    " ",
    pad2(date.getHours()),
    ":",
    pad2(date.getMinutes()),
  ].join("");
}

export function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatExpiry(value) {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const diff = time - Date.now();
  if (diff <= 0) return "已过期";
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.ceil(diff / (60 * 1000)))} 分钟后过期`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.ceil(diff / hour))} 小时后过期`;
  }
  return `${Math.max(1, Math.ceil(diff / day))} 天后过期`;
}
