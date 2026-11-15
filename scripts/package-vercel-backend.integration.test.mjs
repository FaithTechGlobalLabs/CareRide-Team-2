import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  committedRepository,
  compiledRepository,
} from "./package-vercel-backend.fixtures.mjs";
import { packageBackend } from "./package-vercel-backend.mjs";

void test("names the default package after HEAD and replaces only that artifact on repeat runs", async () => {
  const { repository, sha } = await committedRepository();
  const output = path.join(repository, ".artifacts", `vercel-backend-${sha}`);
  const sibling = path.join(repository, ".artifacts", "keep-other-artifact");
  await mkdir(sibling, { recursive: true });
  await writeFile(path.join(sibling, "sentinel"), "keep");
  await packageBackend(repository);
  await writeFile(path.join(output, "stale-file"), "remove");
  await writeFile(
    path.join(repository, "backend/dist/index.js"),
    "export const rebuilt = true;\n"
  );
  await packageBackend(repository);
  await assert.rejects(readFile(path.join(output, "stale-file")), {
    code: "ENOENT",
  });
  assert.equal(
    await readFile(path.join(output, "backend/dist/index.js"), "utf8"),
    "export const rebuilt = true;\n"
  );
  assert.equal(await readFile(path.join(sibling, "sentinel"), "utf8"), "keep");
});

void test("preserves the existing commit artifact when compiled output validation fails", async () => {
  const { repository, sha } = await committedRepository();
  const output = path.join(repository, ".artifacts", `vercel-backend-${sha}`);
  await packageBackend(repository);
  await writeFile(path.join(output, "sentinel"), "keep");
  const contractsPath = path.join(
    repository,
    "packages/api-contracts/package.json"
  );
  const contracts = JSON.parse(await readFile(contractsPath, "utf8"));
  contracts.exports["./missing"] = { default: "./dist/missing.js" };
  await writeFile(contractsPath, JSON.stringify(contracts));
  await assert.rejects(packageBackend(repository), /Missing compiled output/);
  assert.equal(await readFile(path.join(output, "sentinel"), "utf8"), "keep");
});

void test("packages compiled workspaces and SQL, retaining the lockfile and excluding source/secrets", async () => {
  const repository = await compiledRepository();
  const output = path.join(repository, "deployment");
  await packageBackend(repository, output);
  const config = JSON.parse(
    await readFile(path.join(output, "vercel.json"), "utf8")
  );
  assert.equal(config.framework, "express");
  assert.equal(config.outputDirectory, "backend/dist");
  assert.ok(
    config.buildCommand?.trim(),
    "An empty build command makes Vercel select static output instead of Express"
  );
  assert.match(config.installCommand, /--omit=dev/);
  const manifest = JSON.parse(
    await readFile(path.join(output, "package.json"), "utf8")
  );
  assert.equal(manifest.main, "backend/dist/index.js");
  assert.equal(manifest.engines.node, "24.x");
  assert.equal(manifest.devEngines, undefined);
  assert.deepEqual(manifest.workspaces, [
    "backend",
    "react-web-careride",
    "packages/*",
  ]);
  for (const filename of [
    "package-lock.json",
    "backend/dist/index.js",
    "backend/db/002_notifications.sql",
    "packages/api-contracts/dist/rides/ride-requests.js",
    "packages/api-contracts/package.json",
    "react-web-careride/package.json",
  ])
    assert.equal(
      await readFile(path.join(output, filename), "utf8"),
      await readFile(path.join(repository, filename), "utf8")
    );
  const files = await readdir(output, { recursive: true });
  assert.ok(
    !files.some((filename) =>
      /(?:^|\/)(?:src|node_modules|data|__tests__|__mocks__|tests?|\.env(?:\..*)?)(?:\/|$)/.test(
        filename
      )
    )
  );
  assert.ok(!files.includes("backend/package-lock.json"));
  assert.ok(!files.includes(".vercel"));
  await writeFile(path.join(output, "sentinel"), "keep");
  await assert.rejects(packageBackend(repository, output), { code: "EEXIST" });
  assert.equal(await readFile(path.join(output, "sentinel"), "utf8"), "keep");
});

void test("copies only the direct Vercel project identity into the package", async () => {
  const repository = await compiledRepository();
  const vercel = path.join(repository, ".vercel");
  await mkdir(vercel);
  const identity = {
    projectId: "prj_backend",
    orgId: "team_careride",
    projectName: "care-ride-team-2",
  };
  await writeFile(
    path.join(vercel, "project.json"),
    JSON.stringify({
      ...identity,
      settings: { rootDirectory: "." },
      token: "exclude-me",
    })
  );
  await writeFile(
    path.join(vercel, ".env.production.local"),
    "SECRET=exclude-me"
  );
  await writeFile(
    path.join(vercel, "repo.json"),
    JSON.stringify({ projects: [] })
  );
  const output = path.join(repository, "deployment");
  await packageBackend(repository, output);
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(output, ".vercel/project.json"), "utf8")
    ),
    identity
  );
  assert.deepEqual(await readdir(path.join(output, ".vercel")), [
    "project.json",
  ]);
});

void test("rejects invalid direct links before creating the package", async () => {
  for (const contents of [
    "{",
    "null",
    JSON.stringify({ settings: {} }),
    JSON.stringify({ projectId: "prj_backend", orgId: " " }),
  ]) {
    const repository = await compiledRepository();
    await mkdir(path.join(repository, ".vercel"));
    await writeFile(path.join(repository, ".vercel/project.json"), contents);
    const output = path.join(repository, "deployment");
    await assert.rejects(
      packageBackend(repository, output),
      /Invalid Vercel project link/
    );
    await assert.rejects(readdir(output), { code: "ENOENT" });
  }
});

void test("refuses missing compiled contracts before creating the deployment directory", async () => {
  const repository = await compiledRepository();
  const contractsPath = path.join(
    repository,
    "packages/api-contracts/package.json"
  );
  const contracts = JSON.parse(await readFile(contractsPath, "utf8"));
  contracts.exports["./missing"] = { default: "./dist/missing.js" };
  await writeFile(contractsPath, JSON.stringify(contracts));
  const output = path.join(repository, "deployment");
  await assert.rejects(
    packageBackend(repository, output),
    /Missing compiled output:.*missing\.js/
  );
  await assert.rejects(readdir(output), { code: "ENOENT" });
});

void test("rejects output inside the build tree", async () => {
  const repository = await mkdtemp(
    path.join(os.tmpdir(), "careride-package-path-test-")
  );
  await assert.rejects(
    packageBackend(repository, path.join(repository, "backend/dist/package")),
    /outside the build directories/
  );
});
