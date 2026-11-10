# Working on vaultgate-frontend

The web frontend of VaultGate (the `vaultgate` repository holds the API, the gateway and
the rest). `docs/architecture.md` is the plan: the stack, the structure, the practices
and the milestones (F0 to F6).

## Workflow

- Work milestone by milestone from `docs/architecture.md`. Every step gets its own branch
  from `main`, named `feature/<milestone>_<name>/<branch_name>`
  (e.g. `feature/f1_signin/oidc_login`). Work outside a milestone (tooling, CI) uses
  `feature/tooling/<branch_name>`.
- One PR per branch. The owner reviews; merge with **squash** only after approval and
  green CI.
- One PR open at a time: finish a scope (approved and merged) before opening the next.
- Commits and PRs are authored as the repository owner. Do **not** add `Co-Authored-By`,
  `Claude-Session` or "Generated with Claude Code" lines to commit messages, PR
  descriptions or squash-merge messages (write the squash message explicitly).
- Tick a milestone in `docs/architecture.md` in the PR that completes it.

## PR review loop

The **Claude review** GitHub Action (`.github/workflows/claude-review.yml`) is the only
automatic reviewer, with the guidelines in `.github/claude-review.md`. Do not run any
other reviewer on a PR unless the owner asks.

After opening a PR, subscribe the session to its activity, then:

1. Fix every 🔴 blocking finding that holds up, and the 🟡 suggestions that are cheap and
   clearly right; push.
2. Do not reply on PR threads. Resolve the threads whose findings were fixed; leave the
   others open.
3. Tell the owner, in the session, which findings were acted on, which were declined or
   deferred, and why.

If the Action fails or posts nothing, report it to the owner instead of reviewing in its
place.

## Checks before pushing

- `npm run check`: types, lint, format, tests and build, as CI runs them.

## Code

- Follow the structure in `docs/architecture.md`: a feature never imports from another
  feature.
- Every user-visible string goes through `src/i18n` (English is the source language).
- Tests find elements by role and name, as a user would.
- Never store tokens outside memory, and never render raw HTML.
