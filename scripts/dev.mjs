import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["./apps/api/src/server/index.mjs"], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
