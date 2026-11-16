import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "../..");
const usage = `Usage: node backend/deployment/setup-database.mjs <environment> [--seed | --schema-only] [--check] [--git-branch <branch>]

Passes the environment to Vercel (development, preview, production, or a custom environment).
Defaults to schema only. --seed also creates demo accounts and sample data.
--check prints the target host/database without connecting or running setup.
Requires an installed, authenticated Vercel CLI and a root .vercel/project.json link.`;

export function parseOptions(args) {
  const [environment, ...flags] = args;
  if (!environment || environment.startsWith("-")) throw new Error(usage);
  const options = { environment, seed: false, check: false };
  let mode;
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    if (flag === "--seed" || flag === "--schema-only") {
      if (mode && mode !== flag) {
        throw new Error("Choose either --seed or --schema-only.");
      }
      mode = flag;
      options.seed = flag === "--seed";
    } else if (flag === "--check") {
      options.check = true;
    } else if (flag === "--git-branch") {
      const branch = flags[++index];
      if (!branch || branch.startsWith("-")) {
        throw new Error("--git-branch requires a branch name.");
      }
      options.gitBranch = branch;
    } else {
      throw new Error(`Unknown option: ${flag}\n${usage}`);
    }
  }
  return options;
}

function exitCode(result) {
  if (result.error) {
    throw new Error(
      `Unable to start command (${result.error.code ?? "unknown"}).`
    );
  }
  return result.status ?? 1;
}

export function executeSetup(
  options,
  { env = process.env, runCommand = spawnSync, log = console.log } = {}
) {
  if (!env.DATABASE_URL?.trim()) {
    throw new Error(
      "Vercel DATABASE_URL is unavailable; refusing local fallback."
    );
  }
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("Vercel DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    url.pathname.length < 2
  ) {
    throw new Error(
      "Vercel DATABASE_URL must include a PostgreSQL host, user, password, and database."
    );
  }

  log(
    `Environment: ${options.environment}; host: ${url.hostname}; database: ${url.pathname.slice(1)}`
  );
  if (options.check) return 0;

  // Reject fallback before importing the backend, and prevent any local dotenv
  // files or Cloud SQL settings from redirecting the selected Vercel connection.
  const setupEnv = {
    ...env,
    DB_SKIP_DOTENV: "1",
    INSTANCE_CONNECTION_NAME: "",
    POSTGRES_HOST: "",
    DB_HOST: "",
  };
  return exitCode(
    runCommand(
      "npm",
      [
        "--prefix",
        repositoryRoot,
        "run",
        "db:setup",
        "--workspace=backend",
        ...(options.seed ? [] : ["--", "--schema-only"]),
      ],
      { cwd: repositoryRoot, env: setupEnv, stdio: "inherit" }
    )
  );
}

export function setupDatabase(
  options,
  { root = repositoryRoot, env = process.env, runCommand = spawnSync } = {}
) {
  let link;
  try {
    link = JSON.parse(
      readFileSync(path.join(root, ".vercel/project.json"), "utf8")
    );
  } catch {
    throw new Error(
      "Missing or invalid .vercel/project.json; link the repository to the intended backend project first."
    );
  }
  if (
    !/^prj_[\w]+$/.test(link.projectId ?? "") ||
    !/^(team_|user_)[\w]+$/.test(link.orgId ?? "")
  ) {
    throw new Error(
      "The Vercel link must contain valid projectId and orgId values."
    );
  }

  const cliEnv = { ...env };
  for (const key of Object.keys(cliEnv)) {
    if (
      /^(DATABASE_URL|POSTGRES_|PG|DB_|DOTENV_|INSTANCE_CONNECTION_NAME$|NODE_OPTIONS$)/.test(
        key
      )
    ) {
      delete cliEnv[key];
    }
  }
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), "careride-vercel-env-")
  );
  try {
    return exitCode(
      runCommand(
        "vercel",
        [
          "env",
          "run",
          "-e",
          options.environment,
          "--project",
          link.projectId,
          "--scope",
          link.orgId,
          "--cwd",
          temporaryDirectory,
          ...(options.gitBranch ? ["--git-branch", options.gitBranch] : []),
          "--",
          process.execPath,
          scriptPath,
          "--execute",
          options.environment,
          ...(options.seed ? ["--seed"] : []),
          ...(options.check ? ["--check"] : []),
        ],
        { cwd: temporaryDirectory, env: cliEnv, stdio: "inherit" }
      )
    );
  } finally {
    // Only remove our own empty temporary directory; never recursively remove files.
    rmdirSync(temporaryDirectory);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log(usage);
  } else {
    try {
      const execute = args[0] === "--execute";
      const options = parseOptions(execute ? args.slice(1) : args);
      process.exitCode = execute
        ? executeSetup(options)
        : setupDatabase(options);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
