const STORAGE_KEY = "linksee_chat_logs";
const MAX_LOGS = 120;
const EVENT_NAME = "linksee-chat:logs-updated";

export function readAppLogs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAppLogs(logs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function appendAppLog({ level = "info", category = "app", message = "", meta = "" }) {
  const nextLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    meta,
  };
  writeAppLogs([nextLog, ...readAppLogs()]);
  return nextLog;
}

export function clearAppLogs() {
  writeAppLogs([]);
}

export function onAppLogsUpdated(callback) {
  if (typeof callback !== "function") return () => {};
  const handler = () => callback(readAppLogs());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
