const fs = require("node:fs");
const path = require("node:path");

function measureDirectory(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return { files: 0, bytes: 0 };
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return { files: 1, bytes: stat.size };
  return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((summary, entry) => {
    const nextPath = path.join(targetPath, entry.name);
    const child = measureDirectory(nextPath);
    return {
      files: summary.files + child.files,
      bytes: summary.bytes + child.bytes,
    };
  }, { files: 0, bytes: 0 });
}

function clearDirectoryContents(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return { files: 0, bytes: 0 };
  const summary = measureDirectory(targetPath);
  fs.readdirSync(targetPath, { withFileTypes: true }).forEach((entry) => {
    fs.rmSync(path.join(targetPath, entry.name), { recursive: true, force: true });
  });
  fs.mkdirSync(targetPath, { recursive: true });
  return summary;
}

function clearDesktopCaches(storage = {}) {
  const targets = [
    { key: "avatars", path: storage.avatars },
    { key: "chatCache", path: storage.chatCache },
  ];
  return targets.reduce((result, target) => {
    const summary = clearDirectoryContents(target.path);
    result.cleared[target.key] = summary;
    result.files += summary.files;
    result.bytes += summary.bytes;
    return result;
  }, { cleared: {}, files: 0, bytes: 0 });
}

module.exports = {
  clearDesktopCaches,
};
