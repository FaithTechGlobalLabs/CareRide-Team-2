# Deploying the compiled backend to Vercel

This packaging-script and Vercel CLI deployment workflow is a workaround for our
current GitHub permissions. We do not have the GitHub permissions needed to
authorize Vercel to connect to this repository through its normal Git integration.
Instead, we build and package the backend locally, then upload the compiled
package with the Vercel CLI. These deployments must be triggered manually; they
are not automatically deployed from GitHub pushes through Vercel's Git integration.

The backend runs as one Node.js Vercel Function through Vercel's native Express
integration, retaining its existing routes and port-listener entrypoint.
No Docker image or additional bundler is required.

## Build, then package

From the repository root:

```sh
npm run build --workspace=backend
node scripts/package-vercel-backend.mjs
```

The build first compiles `api-contracts`, then compiles the backend. The packaging
script copies **both** output directories into
`.artifacts/vercel-backend-<short-commit-SHA>` and prints its path. It uses
`git rev-parse --short HEAD` for the suffix. After validating compiled entrypoints
and the project link, it deletes that commit's existing artifact directory, if
present, and recreates it. Other artifact directories are retained.

An optional argument selects a different **new** output directory; existing
explicit paths are still refused. Always rebuild first so the compiled files
represent the version you intend to deploy. The SHA identifies the current HEAD;
uncommitted changes can still be included in the compiled output.

```text
package.json
package-lock.json
vercel.json
backend/package.json
backend/dist/
backend/db/
packages/api-contracts/package.json
packages/api-contracts/dist/
react-web-careride/package.json
```

The frontend manifest preserves the workspace declarations in the root lockfile;
frontend code and dependencies are not needed. The package excludes application
source, tests, secrets, uploads, JSON data, and local `node_modules`.

The generated Vercel configuration runs only `node --version` as its build command;
it does not compile the application. Do not use an empty build command: the Vercel
CLI treats it as static output and bypasses the native Express builder, causing
the `functions` file-inclusion pattern to fail with `unused_function`.
Vercel installs **production** dependencies from the root lockfile on Linux,
recognizes `backend/dist/index.js` as the Express entrypoint, and assembles the
Function using dependency tracing. Explicit file includes retain runtime SQL
assets and the compiled contracts. This is not the `.vercel/output` format, so
use a normal deployment rather than `--prebuilt`.

Installing native dependencies such as bcrypt on Vercel avoids shipping macOS
binaries. The generated manifest selects Node.js 24, supported by Vercel and the
installed CLI, and omits the workstation-specific exact npm-version requirement.
Dependency versions remain pinned by the copied root lockfile. The repository's
own package manifests are unchanged.

## Deploy and connect Neon

Use the generated directory as the Vercel project root. Run the installed CLI
from that directory, or use `vercel --cwd <package-directory>`. Confirm the
backend project/team when linking. Test a preview before promoting to production.

For packages inside this Git checkout, `--cwd` alone is insufficient when the
repository has a `.vercel/repo.json` link. The CLI can select that link and reset
the deployment directory to the repository root, uploading source manifests
instead of the compiled package. The packager now creates a direct
`.vercel/project.json` link inside each package when the repository has one. It
copies only `projectId`, `orgId`, and the optional `projectName`, excluding build
settings, credentials, and environment files. It validates the IDs before
creating the package and rejects malformed or settings-only link files.

```sh
vercel project inspect --cwd <package-directory>
vercel deploy --cwd <package-directory>
```

Confirm that the repository's direct link identifies the intended backend project
and team before packaging. If no direct link exists, packaging still succeeds and
prints a message that linking is required. In that case, package outside the Git
checkout and link that standalone directory to the existing backend project.

Set the provisioned Neon connection string as `DATABASE_URL` and configure a
non-default `JWT_SECRET` in that Vercel project's environment variables. Optional
notification settings also belong there. Do not include `.env` files in the
package. Neon schema setup and migration execution are separate from packaging;
the database must contain the tables and PostGIS features required by the app.

Verify `/health/live`, `/health`, login, and a real ride flow on the deployment.
The packaging script itself does not install dependencies, compile, create or
change a remote Vercel project, run migrations, or deploy anything. It only copies
the existing local project identity when available.

## The Function filesystem

A Function has files containing deployed JavaScript, dependencies, and read-only
assets. Node's `fs` APIs can read packaged files. Relative module and asset paths
still matter, so the package preserves the backend/contracts directory layout.
The generated `includeFiles` setting retains the SQL files read by
`notifications/sqlStore.ts`.

The deployed filesystem is read-only. `/tmp` is writable scratch space, but it is
instance-local and not durable or shared storage. Neon is the durable database.

Some existing account/organization deletion handlers in
`backend/src/api/personal.ts` still use the **server-side** `jsonStore.ts` at
`backend/data/store.json`. These need to use Neon before those features can be
relied on in a Function. This is separate from browser local storage, and moving
that JSON store to `/tmp` would not provide database durability.

## References

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Files in Vercel Functions](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)
- [Function filesystem support](https://vercel.com/docs/functions/runtimes#file-system-support)
