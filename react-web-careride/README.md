# React + TypeScript + Vite + shadcn/ui

## Developing locally
1. Install dependencies with `npm ci`

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Linting

Run `npm run lint` to check the frontend with Oxlint, or `npm run lint:fix`
to apply safe automatic fixes. From the repository root, use
`npm run lint --workspace=react-web-careride` for the same frontend check.
The root `npm run lint` checks the repository and automatically uses the
frontend's `.oxlintrc.json` for files in this workspace.

The config was generated with `@oxlint/migrate@1.86.0` and reviewed against
the effective ESLint config. It keeps the TypeScript and React rule severities,
disables the default correctness category to avoid adding unrelated rules, and
ignores the generated route tree and build output. TypeScript overrides that the
migrator could not translate were applied manually. `no-useless-assignment` is
enabled explicitly to preserve the existing check, although Oxlint currently
classifies it as experimental (nursery).

The React Compiler `config` and `gating` diagnostics have no Oxlint equivalents.
Core `no-dupe-args` and `no-octal` were skipped by the migrator because strict
mode supersedes them; TypeScript already disabled `no-dupe-args`. `no-undef`
remains disabled, as in the TypeScript ESLint config. Native Oxlint rule behavior
can differ from ESLint: the first migrated run reports seven `react/purity`
errors involving `new Date()` in `WeekCalendar.tsx`, `AuthScreens.tsx`, and
`StaffScreens.tsx` that the previous linter did not report.

For editor diagnostics, use the Oxc extension (`oxc.oxc-vscode`).

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
