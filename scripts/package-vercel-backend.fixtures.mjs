import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function compiledRepository() {
  const actual = fileURLToPath(new URL("../", import.meta.url));
  const root = await mkdtemp(
    path.join(os.tmpdir(), "careride-compiled-package-test-")
  );
  const files = [
    "package.json",
    "package-lock.json",
    "backend/package.json",
    "packages/api-contracts/package.json",
    "react-web-careride/package.json",
    "backend/db/002_notifications.sql",
  ];
  for (const filename of files) {
    await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await writeFile(
      path.join(root, filename),
      await readFile(path.join(actual, filename))
    );
  }
  const contracts = JSON.parse(
    await readFile(
      path.join(root, "packages/api-contracts/package.json"),
      "utf8"
    )
  );
  // Tiny emitted-output fixtures test packaging without building the application.
  for (const filename of [
    "backend/dist/index.js",
    "backend/dist/__tests__/excluded.test.js",
    ...Object.values(contracts.exports).map((entry) =>
      path.join("packages/api-contracts", entry.default)
    ),
  ]) {
    await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await writeFile(
      path.join(root, filename),
      "export const fixture = true;\n"
    );
  }
  await writeFile(path.join(root, ".env"), "TEST_SECRET=do-not-package\n");
  await writeFile(
    path.join(root, "backend/dist/.env"),
    "TEST_SECRET=do-not-package\n"
  );
  return root;
}

export async function committedRepository() {
  const repository = await compiledRepository();
  execFileSync("git", ["init", "--quiet"], { cwd: repository });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Packaging Test",
      "-c",
      "user.email=packaging@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "Packaging fixture",
    ],
    { cwd: repository }
  );
  const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  return { repository, sha };
}
