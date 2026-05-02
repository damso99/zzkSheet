import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

const api = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: "5178" },
  stdio: "inherit",
});

const vite = spawn(npmCommand, ["exec", "vite", "--", "--host", "127.0.0.1", "--port", "5177"], {
  stdio: "inherit",
  shell: isWindows,
});

function shutdown() {
  api.kill();
  vite.kill();
}

api.on("exit", (code) => {
  if (code && code !== 0) vite.kill();
});

vite.on("exit", (code) => {
  api.kill();
  process.exit(code ?? 0);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
