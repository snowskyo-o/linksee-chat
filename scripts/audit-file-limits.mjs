import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const warnLimit = 100;
const failLimit = 500;
const hardLimit = 1000;

const includeExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".vue",
  ".css",
  ".scss",
  ".html",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".ps1",
]);

const skipDirNames = new Set([
  ".git",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
  "release",
]);

const skipFileNames = new Set([
  "package-lock.json",
]);

async function walk(dirPath, bucket = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      await walk(fullPath, bucket);
      continue;
    }
    if (!entry.isFile()) continue;
    if (skipFileNames.has(entry.name)) continue;
    if (!includeExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    bucket.push(fullPath);
  }
  return bucket;
}

async function countLines(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  if (!raw) return 0;
  return raw.split(/\r?\n/).length;
}

function toRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll("\\", "/");
}

function printSection(title, items) {
  if (!items.length) return;
  console.log(`\n${title}`);
  items.forEach((item) => {
    console.log(`- ${item.lines} ${item.path}`);
  });
}

async function main() {
  const files = await walk(rootDir);
  const rows = [];
  for (const filePath of files) {
    rows.push({
      path: toRelative(filePath),
      lines: await countLines(filePath),
    });
  }

  rows.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));

  const hardFailures = rows.filter((item) => item.lines >= hardLimit);
  const failures = rows.filter((item) => item.lines >= failLimit && item.lines < hardLimit);
  const warnings = rows.filter((item) => item.lines > warnLimit && item.lines < failLimit);

  console.log(`Scanned ${rows.length} source files`);
  console.log(`Warn > ${warnLimit} lines, fail >= ${failLimit} lines, hard fail >= ${hardLimit} lines`);

  printSection("Hard Failures", hardFailures);
  printSection("Failures", failures);
  printSection("Warnings", warnings.slice(0, 30));

  if (warnings.length > 30) {
    console.log(`- ... ${warnings.length - 30} more warning files`);
  }

  if (hardFailures.length || failures.length) {
    process.exitCode = 1;
    return;
  }

  console.log("\nFile limit audit passed");
}

main().catch((error) => {
  console.error("[audit-file-limits] failed", error);
  process.exitCode = 1;
});
