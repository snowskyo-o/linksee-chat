import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 0}`));
    });
  });
}

async function main() {
  await run(process.execPath, ["./node_modules/vite/bin/vite.js", "build", "--config", "./apps/web/vite.config.mjs"], {
    cwd: process.cwd(),
  });

  await run(process.execPath, ["./node_modules/electron/cli.js", "./apps/desktop/main.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DESKTOP_PORT: process.env.DESKTOP_PORT || "3010",
    },
  });
}

main().catch((error) => {
  console.error("[desktop-dev]", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
