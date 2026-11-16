# Database setup using Vercel environments

Run from the repository root with an installed, authenticated Vercel CLI and
the intended backend project linked in `.vercel/project.json`:

```sh
# Inspect the fetched target without connecting to PostgreSQL or applying changes.
node backend/deployment/setup-database.mjs preview --check

# Create the schema only (the default for every environment).
node backend/deployment/setup-database.mjs preview
node backend/deployment/setup-database.mjs production

# Include demo accounts and sample data intentionally.
node backend/deployment/setup-database.mjs development --seed
node backend/deployment/setup-database.mjs preview --seed

# Custom environments and branch-specific Preview variable overrides.
node backend/deployment/setup-database.mjs staging
node backend/deployment/setup-database.mjs preview --git-branch feature/example
```

The environment name is passed through to Vercel without a local allowlist.
The script resolves its repository path independently of the current directory.
It uses the project/team IDs from the repository link, runs Vercel from an empty
temporary directory, and excludes inherited database and dotenv settings.
The setup subprocess sets `DB_SKIP_DOTENV=1` and clears Cloud SQL socket overrides.
This avoids Vercel CLI 59.15.1 giving local `.env` values priority over remote values.

A complete `DATABASE_URL` must be available from Vercel. Missing, unreadable
Secret, or malformed values stop execution instead of falling back to a local
database. The script prints the environment, host, and database, never the URL,
username, or password. `--check` only validates configuration; it does not test
connectivity. `--schema-only` is accepted explicitly; it cannot be combined with
`--seed`.

Environment names do not guarantee separate databases: verify the printed target.
`--git-branch` selects Vercel's stored branch-specific variables; it does not
retrieve Neon credentials injected only into an individual preview deployment.
Setup initializes the existing schema script; it is not a migration runner.
Demo accounts use the shared password documented in `docs/POSTGRES.md`.

Run the deployment wrapper's focused checks without Vercel or PostgreSQL access:

```sh
node --test backend/deployment/setup-database.integration.test.mjs
```
