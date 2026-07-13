import crypto from "node:crypto";

const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40 };
const activeLevel = String(process.env.LOG_LEVEL || "info").toLowerCase();

function shouldWrite(level) {
  return (LEVEL_WEIGHT[level] || LEVEL_WEIGHT.info) >= (LEVEL_WEIGHT[activeLevel] || LEVEL_WEIGHT.info);
}

function cleanMeta(meta = {}) {
  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
}

export function log(level, message, meta = {}) {
  const normalizedLevel = LEVEL_WEIGHT[level] ? level : "info";
  if (!shouldWrite(normalizedLevel)) return;
  const entry = {
    ts: new Date().toISOString(),
    level: normalizedLevel,
    service: "linksee-chat",
    message,
    ...cleanMeta(meta),
  };
  const line = JSON.stringify(entry);
  if (normalizedLevel === "error") console.error(line);
  else if (normalizedLevel === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message, meta) => log("debug", message, meta),
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta),
};

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const status = res.statusCode;
    logger[status >= 500 ? "error" : status >= 400 ? "warn" : "info"]("http.request", {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      durationMs: Math.round(durationMs),
      userId: req.userId,
    });
  });

  next();
}

export function errorLogger(error, req, res, _next) {
  logger.error("http.error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.userId,
    error: error?.message || String(error),
    stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
  });
  if (res.headersSent) return;
  res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Server error" });
}
