import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  cliProbe,
  deploymentRepository,
  developmentUrl,
  previewUrl,
} from "./setup-database.fixtures.mjs";
import {
  executeSetup,
  parseOptions,
  setupDatabase,
} from "./setup-database.mjs";

void test("remote Preview wins over both shell and local-file development credentials", () => {
  const root = deploymentRepository();
  let workingDirectory;
  const status = setupDatabase(parseOptions(["preview", "--check"]), {
    root,
    env: {
      ...process.env,
      DATABASE_URL: developmentUrl,
      POSTGRES_URL: developmentUrl,
      PGOPTIONS: "-c search_path=wrong_schema",
      INSTANCE_CONNECTION_NAME: "development:region:instance",
      DOTENV_CONFIG_OVERRIDE: "true",
    },
    runCommand(command, args, options) {
      assert.equal(command, "vercel");
      workingDirectory = options.cwd;
      assert.equal(existsSync(path.join(workingDirectory, ".env")), false);
      for (const key of [
        "DATABASE_URL",
        "POSTGRES_URL",
        "PGOPTIONS",
        "INSTANCE_CONNECTION_NAME",
        "DOTENV_CONFIG_OVERRIDE",
      ]) {
        assert.equal(options.env[key], undefined);
      }
      const result = cliProbe(args, options);
      assert.equal(result.status, 0, result.stderr);
      assert.match(
        result.stdout,
        /Environment: preview; host: preview.example.test; database: careride/
      );
      assert.doesNotMatch(
        result.stdout,
        /development.example.test|preview_password|preview_user/
      );
      return result;
    },
  });
  assert.equal(status, 0);
  assert.equal(existsSync(workingDirectory), false);
  assert.match(
    readFileSync(path.join(root, ".env"), "utf8"),
    /development.example.test/
  );
});

void test("forwards custom environment names and branch overrides to Vercel", () => {
  const root = deploymentRepository();
  setupDatabase(parseOptions(["staging", "--git-branch", "feature/example"]), {
    root,
    runCommand(_command, args) {
      assert.equal(args[args.indexOf("-e") + 1], "staging");
      assert.equal(args[args.indexOf("--git-branch") + 1], "feature/example");
      assert.equal(args[args.indexOf("--project") + 1], "prj_backend");
      assert.equal(args[args.indexOf("--scope") + 1], "team_careride");
      return { status: 0 };
    },
  });
});

void test("missing and malformed remote URLs stop before setup can load local files", () => {
  for (const value of [
    undefined,
    "",
    "<unavailable>",
    "https://example.test/db",
    "postgresql://localhost/careride",
  ]) {
    assert.throws(
      () =>
        executeSetup(parseOptions(["preview"]), {
          env: { DATABASE_URL: value },
          runCommand() {
            assert.fail("setup must not start");
          },
          log() {},
        }),
      /Vercel DATABASE_URL/
    );
  }
});

void test("defaults to schema only, opts into seeding, and preserves setup failures", () => {
  for (const seed of [false, true]) {
    const status = executeSetup(
      { environment: "production", seed },
      {
        env: {
          DATABASE_URL: previewUrl,
          INSTANCE_CONNECTION_NAME: "development:region:instance",
        },
        runCommand(command, args, options) {
          assert.equal(command, "npm");
          assert.equal(args.includes("--schema-only"), !seed);
          assert.equal(options.env.DB_SKIP_DOTENV, "1");
          assert.equal(options.env.INSTANCE_CONNECTION_NAME, "");
          assert.equal(options.env.POSTGRES_HOST, "");
          assert.equal(options.env.DB_HOST, "");
          assert.equal(options.env.DATABASE_URL, previewUrl);
          return { status: 9 };
        },
        log() {},
      }
    );
    assert.equal(status, 9);
  }
});

void test("the real backend skips local dotenv loading only when explicitly requested", () => {
  for (const skip of ["1", "0"]) {
    const probe = `
      import assert from "node:assert/strict";
      import dotenv from "dotenv";
      let calls = 0;
      dotenv.config = () => { calls++; return { parsed: {} }; };
      const { pool } = await import(${JSON.stringify(new URL("../src/db/db.ts", import.meta.url).href)});
      assert.equal(calls, ${skip === "1" ? 0 : 2});
      await pool.end();
    `;
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", probe],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        env: {
          ...process.env,
          DB_SKIP_DOTENV: skip,
          DATABASE_URL: previewUrl,
          INSTANCE_CONNECTION_NAME: "",
          POSTGRES_HOST: "",
          DB_HOST: "",
          NODE_OPTIONS: "",
        },
        encoding: "utf8",
      }
    );
    assert.equal(result.status, 0, result.stderr);
  }
});

void test("rejects invalid arguments and missing project links without starting commands", () => {
  for (const args of [
    [],
    ["--seed"],
    ["preview", "--unknown"],
    ["preview", "--git-branch"],
    ["preview", "--seed", "--schema-only"],
  ]) {
    assert.throws(() => parseOptions(args));
  }
  assert.throws(
    () =>
      setupDatabase(parseOptions(["preview"]), {
        root: path.join(deploymentRepository(), "missing"),
        runCommand() {
          assert.fail("Vercel must not start");
        },
      }),
    /project.json/
  );
});
