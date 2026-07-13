import { Router } from "express";
import { env } from "../../../../infra/config/env.mjs";

export const updateRouter = Router();

function compareVersions(a, b) {
  const left = String(a || "0.0.0").split(".").map((part) => Number(part) || 0);
  const right = String(b || "0.0.0").split(".").map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

updateRouter.get("/updates/latest", (req, res) => {
  const currentVersion = String(req.query.currentVersion || "").trim();
  const latestVersion = env.updates.latestVersion || process.env.npm_package_version || "";
  const hasUpdate = latestVersion && currentVersion && compareVersions(latestVersion, currentVersion) > 0;
  const unsupported = env.updates.minSupportedVersion
    ? compareVersions(currentVersion, env.updates.minSupportedVersion) < 0
    : false;

  res.json({
    ok: true,
    data: {
      latestVersion,
      currentVersion,
      hasUpdate: Boolean(hasUpdate),
      mandatory: Boolean(env.updates.mandatory || unsupported),
      minSupportedVersion: env.updates.minSupportedVersion,
      downloadUrl: env.updates.downloadUrl,
      notesUrl: env.updates.notesUrl,
    },
  });
});
