import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const previewUrl =
  "postgresql://preview_user:preview_password@preview.example.test/careride?sslmode=require";
export const developmentUrl =
  "postgresql://development_user:development_password@development.example.test/careride";

export function deploymentRepository() {
  const root = mkdtempSync(path.join(os.tmpdir(), "careride-deployment-test-"));
  mkdirSync(path.join(root, ".vercel"));
  writeFileSync(
    path.join(root, ".vercel/project.json"),
    JSON.stringify({
      projectId: "prj_backend",
      orgId: "team_careride",
    })
  );
  writeFileSync(path.join(root, ".env"), `DATABASE_URL=${developmentUrl}\n`);
  return root;
}

// Emulate the affected CLI's merge at a real process boundary, without accessing
// Vercel or PostgreSQL. Loading from the repository instead of an empty directory
// makes the development URL win, just as Vercel CLI 59.15.1 does.
export function cliProbe(args, options) {
  const separator = args.indexOf("--");
  const fixture = `
    const fs = require("node:fs");
    const { spawnSync } = require("node:child_process");
    let local = {};
    if (fs.existsSync(".env")) {
      const line = fs.readFileSync(".env", "utf8").trim();
      local.DATABASE_URL = line.slice("DATABASE_URL=".length);
    }
    const result = spawnSync(${JSON.stringify(args[separator + 1])},
      ${JSON.stringify(args.slice(separator + 2))}, {
        env: { DATABASE_URL: ${JSON.stringify(previewUrl)}, ...local, ...process.env },
        stdio: "inherit",
      });
    process.exit(result.status ?? 1);
  `;
  return spawnSync(process.execPath, ["-e", fixture], {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
}
