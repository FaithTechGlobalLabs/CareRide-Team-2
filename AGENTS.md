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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
