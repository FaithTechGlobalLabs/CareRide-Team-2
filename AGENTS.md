## Scope

Instructions for working in this repository.

## Dependency Policy
- Never install new dependencies or upgrade dependencies without explicit user confirmation.
- You may `npm ci --prefer-offline` to install known dependencies when the repo is missing its node_modules folder, or that folder is empty.
- Before install/upgrade, show exact command(s) and wait for approval.

## Change Safety

- Keep edits focused to requested scope.
- Do not run destructive git/file commands without explicit approval.
- If unexpected unrelated changes are detected, stop and ask.
- Never store secrets, keys, or sensitive info in version control.