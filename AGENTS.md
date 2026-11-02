## Scope

Instructions for working in this repository.

## Dependency Policy

- Never install new dependencies or upgrade dependencies without explicit user confirmation.
- You may `npm ci --prefer-offline` to install known dependencies to their lockfile versions when the repo is missing its node_modules folder, or that folder is empty.
- Before install/upgrade, show exact command(s) and wait for approval.

## Change Safety

- Keep edits focused to requested scope.
- Do not run destructive git/file commands without explicit approval.
- If unexpected unrelated changes are detected, stop and ask.
- Never store secrets, keys, or sensitive info in version control.

## Common Turborepo commands

Run these from the repository root using the installed CLI (`npx --no-install` avoids installing packages after you already installed `turbo`).
Prefer checks scoped to changed files or workspaces before repository-wide checks.

| Task                                                   | Command                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Start backend and frontend                             | `npx --no-install turbo run dev`                                |
| Start backend only                                     | `npx --no-install turbo run dev --filter=backend`               |
| Start frontend only                                    | `npx --no-install turbo run dev --filter=react-web-careride`    |
| Typecheck all workspaces                               | `npx --no-install turbo run typecheck`                          |
| Typecheck one workspace                                | `npx --no-install turbo run typecheck --filter=backend`         |
| Run default fast test suites                           | `npx --no-install turbo run test`                               |
| Run backend default fast tests (Vitest and Node)       | `npx --no-install turbo run test --filter=backend`              |
| Run frontend default fast tests (Vitest)               | `npx --no-install turbo run test --filter=react-web-careride`   |
| Run Node test suites across workspaces                 | `npx --no-install turbo run test:node`                          |
| Run backend database integration tests                 | `npx --no-install turbo run test:integration`                   |
| Run one integration test file by name                  | `npx --no-install turbo run test:integration -- -- rideQueries` |
| Check lint and formatting                              | `npx --no-install turbo run lint format`                        |
| Build all workspaces (requires explicit user approval) | `npx --no-install turbo run build`                              |

- Filters use package names: `backend`, `react-web-careride`, or `@careride/api-contracts`. Required task dependencies still run; backend typechecking also typechecks API contracts.
- Append `--dry=json` before any task-argument separator (`--`) to inspect a task plan without running it. Cached tasks may replay previous results; `--force` reruns them.
- Integration tests require Docker and run without caching. See [PostgreSQL integration test setup](docs/POSTGRES.md#database-integration-tests).
- For a single backend unit test, use `npm run test:unit --workspace=backend -- path/to/file.test.ts`; the default backend `test` script chains Vitest and Node rather than forwarding arguments to Vitest alone.

## Agent skills

### Issue tracker

Track specs, PRDs, and tickets, including drafts, as local Markdown under `.scratch/`.
Before tracker operations, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage roles as local `Status:` values.
Before triaging, read `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context glossary and ADR layout.
Before exploring the codebase, read `docs/agents/domain.md`.

### Backend architecture

Before backend work, read and follow [Clean architecture, aggregate ownership, and explicit transactions](docs/adr/0001-clean-architecture-aggregates-and-transactions.md).

## Lint Policy

- `@typescript-eslint/no-explicit-any` is intentionally relaxed for:
  - test files (`*.test.*`, `*.spec.*`, `__tests__`, `<project_or_package>/test/`)
  - migration files under the relevant app, such as `backend/src/infrastructure/persistence/migrations/**`
- Keep strict typing elsewhere.

## Testing policy

- Co-locate test mock and fixture factories in sibling files to the files they are factories of. If the folder already has a lot of files create a `__mocks__` folder inside it.
- Use `*.test.ts` / `*.test.tsx` for the normal fast suite run by `npx --no-install turbo run test`.
- Use `*.integration.test.ts` / `*.integration.test.tsx` for integration tests run by `npx --no-install turbo run test:integration`.
- Prefer the normal suite for pure units, isolated components, mappers, validators, and service behavior with test doubles.
- Prefer the integration suite when the test crosses a real project boundary, such as database persistence, HTTP adapters, filesystem, queues, framework middleware, or multiple layers wired together locally.
- Prefer the end-to-end suite for critical user/system flows exercised through the outermost interface, such as browser flows or full HTTP flows through the running app.
- Cover happy path, error path, and edge cases.
- Never remove or disable a failing test to make checks pass unless user explicitly authorizes it.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
