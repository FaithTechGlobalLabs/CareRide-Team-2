# Domain docs

## Layout and reading rules

This repository uses a single-context layout across its workspaces:

- `GLOSSARY.md` at the repository root: shared domain vocabulary.
- `docs/adr/`: architectural decisions.

Before exploring the codebase, read the glossary if it exists.
Read ADRs relevant to the area being explored.

If these documents are absent, proceed silently. Domain-modeling creates them lazily as terms and decisions are resolved.

## Vocabulary

Use glossary terms in issue titles, proposals, code, and tests.
When a needed concept is missing, reconsider the wording or note the gap for domain-modeling.

## Decision conflicts

If a proposal contradicts an ADR, identify the ADR and explain why the decision should be reconsidered.
