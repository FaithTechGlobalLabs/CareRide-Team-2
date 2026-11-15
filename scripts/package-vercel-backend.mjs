import { execFileSync } from "node:child_process";
import { cp, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directories = [
  "backend/dist",
  "backend/db",
  "packages/api-contracts/dist",
];
const manifests = [
  "backend/package.json",
  "packages/api-contracts/package.json",
  "react-web-careride/package.json",
];

async function readProjectLink(repository) {
  const filename = path.join(repository, ".vercel/project.json");
  let contents;
  try {
    contents = await readFile(filename, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
  let link;
  try {
    link = JSON.parse(contents);
  } catch {
    throw new Error(
      `Invalid Vercel project link: ${filename} must contain valid JSON.`
    );
  }
  if (
    typeof link?.projectId !== "string" ||
    !link.projectId.trim() ||
    typeof link?.orgId !== "string" ||
    !link.orgId.trim()
  )
    throw new Error(
      `Invalid Vercel project link: ${filename} requires non-empty projectId and orgId. Link the intended backend project before packaging.`
    );
  // Copy identity only; never carry environment files, credentials, or build settings.
  return {
    projectId: link.projectId,
    orgId: link.orgId,
    ...(typeof link.projectName === "string" && link.projectName.trim()
      ? { projectName: link.projectName }
      : {}),
  };
}

export async function packageBackend(repository, output) {
  const replace = output === undefined;
  if (replace) {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    output = path.join(repository, ".artifacts", `vercel-backend-${sha}`);
  }
  for (const directory of directories) {
    const relative = path.relative(path.join(repository, directory), output);
    if (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw new Error(
        "The output directory must be outside the build directories."
      );
  }
  const contracts = JSON.parse(
    await readFile(
      path.join(repository, "packages/api-contracts/package.json"),
      "utf8"
    )
  );
  const required = [
    "backend/dist/index.js",
    ...Object.values(contracts.exports).map((entry) =>
      path.join("packages/api-contracts", entry.default)
    ),
  ];
  for (const filename of required) {
    try {
      const stat = await lstat(path.join(repository, filename));
      if (!stat.isFile()) throw new Error("Expected a regular file");
    } catch {
      throw new Error(
        `Missing compiled output: ${filename}. Run npm run build --workspace=backend first.`
      );
    }
  }

  const projectLink = await readProjectLink(repository);
  await mkdir(path.dirname(output), { recursive: true });
  // Replace only the generated commit folder, after validating the inputs.
  // Explicit output paths must still be new directories.
  if (replace) await rm(output, { recursive: true, force: true });
  await mkdir(output);
  for (const directory of directories) {
    await cp(path.join(repository, directory), path.join(output, directory), {
      recursive: true,
      filter: async (filename) => {
        const stat = await lstat(filename);
        if (stat.isSymbolicLink())
          throw new Error(`Refusing to package a build symlink: ${filename}`);
        const relative = path.relative(repository, filename);
        if (
          relative
            .split(path.sep)
            .some((part) =>
              /^(?:__tests__|__mocks__|tests?|node_modules)$/.test(part)
            )
        )
          return false;
        return (
          stat.isDirectory() ||
          (/\.(?:[cm]?js|json|map|sql|d\.ts)$/.test(filename) &&
            !/\.(?:test|spec)\.[cm]?js(?:\.map)?$/.test(filename))
        );
      },
    });
  }
  for (const filename of ["package-lock.json", ...manifests]) {
    await mkdir(path.dirname(path.join(output, filename)), { recursive: true });
    await cp(path.join(repository, filename), path.join(output, filename));
  }
  const manifest = JSON.parse(
    await readFile(path.join(repository, "package.json"), "utf8")
  );
  // Allow the host's npm patch version while retaining the exact dependency lockfile.
  delete manifest.devEngines;
  manifest.main = "backend/dist/index.js";
  manifest.engines = { ...manifest.engines, node: "24.x" };
  const writeJson = (filename, value) =>
    writeFile(
      path.join(output, filename),
      `${JSON.stringify(value, null, 2)}\n`
    );
  await writeJson("package.json", manifest);
  if (projectLink) {
    await mkdir(path.join(output, ".vercel"));
    await writeJson(".vercel/project.json", projectLink);
  }
  await writeJson("vercel.json", {
    $schema: "https://openapi.vercel.sh/vercel.json",
    framework: "express",
    installCommand:
      "npm ci --omit=dev --workspace=backend --workspace=@careride/api-contracts --include-workspace-root",
    // An empty command selects static output and bypasses the Express builder.
    buildCommand: "node --version",
    outputDirectory: "backend/dist",
    functions: {
      "**": {
        includeFiles:
          "{backend/db/**,packages/api-contracts/package.json,packages/api-contracts/dist/**}",
      },
    },
  });
  await writeFile(
    path.join(output, ".vercelignore"),
    "**/.env\n**/.env.*\n**/node_modules/**\n**/data/**\n"
  );
  return { projectLink, output };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length > 3)
      throw new Error(
        "Usage: node scripts/package-vercel-backend.mjs [new-output-directory]"
      );
    const repository = fileURLToPath(new URL("../", import.meta.url));
    const { projectLink, output } = await packageBackend(
      repository,
      process.argv[2] === undefined ? undefined : path.resolve(process.argv[2])
    );
    console.log(`Compiled Vercel package: ${output}`);
    console.log(
      projectLink
        ? `Direct Vercel project link: ${projectLink.projectName ?? projectLink.projectId} (${projectLink.orgId}).`
        : "No direct Vercel project link found; link the package directory to the intended backend project before deploying."
    );
    console.log(
      "Includes backend/dist, api-contracts/dist, runtime SQL, manifests, and the root lockfile."
    );
    console.log(
      "Vercel will install production dependencies on Linux; the build command only prints the Node.js version."
    );
    console.log(
      "No dependencies were installed, no build was run, and nothing was deployed."
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Packaging failed.");
    process.exitCode = 1;
  }
}
