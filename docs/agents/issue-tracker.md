# Issue tracker: Local Markdown

Specs, PRDs, and tickets—including drafts—live in this repository.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Specs: `.scratch/<feature-slug>/spec.md`
- PRDs: `.scratch/<feature-slug>/prd.md`
- Tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, with one file per ticket.
- Record ticket triage state in a `Status:` line near the top, using `docs/agents/triage-labels.md`.
- Append discussion under a `## Comments` heading.
- Record blockers as relative links in a `Blocked by:` line. A ticket is unblocked when every blocker is resolved.

## Publishing and fetching

When a skill says "publish to the issue tracker", create or update the appropriate local Markdown file.

When a skill says "fetch the relevant ticket", read its local file. If a ticket number is ambiguous, ask for the feature or path.

External publishing requires a separate explicit user request.
