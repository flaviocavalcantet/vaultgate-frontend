# Architecture and plan

The web frontend of [VaultGate](https://github.com/flaviocavalcantet/vaultgate), the
secure file vault. It is a single-page app that talks to two VaultGate services: the
**API** (who may do what: files, shares, policies, administration) and the **gateway**
(the bytes: uploads and downloads). Users sign in through the same OpenID Connect
provider the API trusts (Keycloak), and the app sends the API their access token.

This document is the plan the repository is built from. A milestone's section is
updated when its work lands.

## Stack

| Area            | Choice                                                                                                       | Why                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build           | Vite, React, TypeScript in strict mode                                                                       | Fast builds, and types strict enough to catch a missing case (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).                                                                             |
| Sign-in         | OpenID Connect with PKCE (`oidc-client-ts`), a public client                                                 | No client secret can live in a browser. Tokens stay in memory, never in `localStorage`, so a script injected later can't read them from storage. Access tokens are short-lived and renewed silently. |
| API client      | Types generated from the API's OpenAPI document (`openapi-typescript`, `openapi-fetch`)                      | The frontend can't drift from the API unnoticed: CI fails when the generated types are stale.                                                                                                        |
| Server state    | TanStack Query                                                                                               | Caching, retries and polling (a file's scan status) without hand-written loading logic.                                                                                                              |
| Routing         | React Router                                                                                                 | Guards per route for signed-in and admin pages; the admin area loaded lazily.                                                                                                                        |
| UI              | Tailwind CSS, with Radix primitives for the interactive components (dialogs, menus, tabs)                    | Accessible behaviour from Radix, styles in the repository, no heavy UI framework. A Radix package is added with the first component that needs it.                                                   |
| Forms           | React Hook Form with Zod                                                                                     | One schema validates the form and types its values.                                                                                                                                                  |
| Text            | i18next, English first                                                                                       | Every string comes from `src/i18n`, and keys are checked by the compiler. A language is one more file.                                                                                               |
| Tests           | Vitest and Testing Library for units, MSW for the API in tests, Playwright end to end, axe for accessibility | Tests go through what the user sees (roles and names), not implementation details.                                                                                                                   |
| Lint and format | oxlint (React, TypeScript, import and `jsx-a11y` rules), Prettier                                            | The linter Vite's template ships with; accessibility mistakes fail the build.                                                                                                                        |

Installed today: what the foundation uses (Vite, React, TypeScript, React Router,
TanStack Query, Zod, i18next, Tailwind, Vitest, Testing Library, oxlint, Prettier). The
rest arrives with the milestone that needs it.

## Structure

```
src/
  app/          the app's frame: providers, routes, error and not-found pages
  config/       runtime configuration (/config.json)
  components/   UI shared by several features
  features/     one folder per feature: its pages, components, hooks and API calls
  i18n/         the strings
  api/          the generated API client (from F1)
  test/         test setup and helpers
```

- **Features own their code.** A feature imports from `components`, `config`, `api` and
  `i18n`, never from another feature. What two features share moves to `components`.
- **Server state lives in TanStack Query**, not in component state or a global store.
  There is no global store until something needs one.
- **One image for every environment.** Addresses (API, gateway, OpenID Connect provider)
  are read from `/config.json` when the app starts, validated, and never baked into the
  build. Nothing in that file is secret.

## Practices

- **Accessibility is part of done:** semantic landmarks, one `<h1>` per page, a skip
  link, visible keyboard focus, labels on every control, and the `jsx-a11y` lint rules.
  From F6, axe runs in the end-to-end tests.
- **Security:**
  - tokens in memory only;
  - no raw HTML rendering (`dangerouslySetInnerHTML` is a lint error);
  - error pages never show an error's text, which may carry internals;
  - a strict Content-Security-Policy with no inline scripts, set by the server that
    serves the app (F6);
  - dependencies audited and the history scanned for secrets in CI.
- **Checks before every push:** `npm run check` (types, lint, format, tests, build), the
  same steps CI runs.

## Sign-in

- **The flow:** authorization code with PKCE, as a public client (`oidc-client-ts`).
  The provider sends the browser back to `/auth/callback`, where the code is exchanged
  once, and the user lands on the page they were going to. That destination is only
  ever a path inside the app: anything else becomes the start page.
- **Tokens are in memory only.** Nothing is written to `localStorage` or
  `sessionStorage` but the flow's own state for the seconds of the redirect (the PKCE
  verifier, which is no credential). So a reload starts signed out. While the
  provider's own session lasts, signing in again asks for no password: it is one click.
- **The access token goes to the API only,** added by the API client
  (`src/api/client.ts`) to requests for the API's address, and renewed with the refresh
  token before it expires.
- **A session ends** when the token expires and can't be renewed, or when the API
  answers 401 to a request that carried it. The app then drops the token and says so
  on the sign-in page.
- **Guards decide what a page shows, never what a user may do.** `RequireAuth` shows the
  sign-in page in place of a route that needs a session. The API checks the token and
  the access policies on every request, whatever the page shows.
- **Admin routes wait for the API.** Who is an administrator is the API's setting (its
  admin groups), and `/me` doesn't say yet whether the caller is one. The frontend
  won't copy that setting: the admin guard comes with F4, once `/me` answers it.

## The API client

`api/openapi.json` is the API's OpenAPI document, exported from the `vaultgate`
repository, and `src/api/schema.d.ts` is generated from it (`npm run api:types`). CI
regenerates the types and fails if they differ from what is committed
(`npm run api:check`), so the types can't drift from the document. To take a newer API,
replace `api/openapi.json` and run `npm run api:types`.

## Files

- **The list** is the API's `GET /files`, a page at a time (20). While any file on the
  page is still uploading or being scanned, it is asked again every 3 seconds, and no
  more once all have settled.
- **An upload** is two requests: `POST /files` registers the file and returns a
  single-use upload intent; the bytes then go to the intent's gateway address with
  `XMLHttpRequest`, which reports progress (`fetch` doesn't). The intent's token goes
  to the gateway only; the user's access token goes to the API only. An upload can be
  cancelled, and leaving the page cancels what is still sending.
- **The state** shown is the upload's, then the scan's: scanning, clean, quarantined
  (with the kinds and counts of what was found, never the content), or unscannable,
  and whether an administrator released it. Text carries it; colour only repeats it.
- **A download** asks the API for a download intent at the moment of the click (it
  lasts minutes and works once) and submits a hidden form with its token to the
  gateway's address (vaultgate ADR 0018). The browser's downloader streams the file to
  disk at any size, and the token never appears in an address. The form is removed as
  soon as it is submitted.

## The image

- **nginx, non-root** (`nginxinc/nginx-unprivileged`), serving the built files on 8080.
  It writes nothing outside `/tmp`, so it runs with a read-only root filesystem.
- **One image for every deployment.** At start, `deploy/start.sh` reads
  `VAULTGATE_API_URL`, `VAULTGATE_GATEWAY_URL`, `VAULTGATE_OIDC_AUTHORITY` and
  `VAULTGATE_OIDC_CLIENT_ID`, and writes `/config.json` and the security headers from
  them. A value that isn't a plain http(s) address stops the start, since it goes into
  a header and a JSON file.
- **The Content-Security-Policy:** the app's own files only (no inline code); network
  calls to the API, the gateway and the identity provider only; forms to the gateway
  only (downloads); no frames, plugins or `<base>`. Also `nosniff`, `no-referrer`, and a
  cross-origin opener policy.
- **Caching:** the hashed files under `/assets/` for a year, `index.html` checked on
  every load, `/config.json` never stored.
- **CI** builds the image on every PR, runs it as it will run (read-only, the headers
  and config from the environment, an unsafe setting refused), scans it with Trivy, and
  on main publishes `ghcr.io/<owner>/vaultgate-frontend:<commit>` and `:main`.

## Milestones

- [x] **F0, Foundation:** the scaffold, tooling and CI; the app's frame (layout,
      navigation, error and not-found pages); runtime configuration; translation-ready text.
- [x] **F1, Sign-in:** login and logout through the OpenID Connect provider, the
      signed-in user (`/me`), the guard for signed-in routes, session expiry; the
      generated API client. See [Sign-in](#sign-in).
- [x] **F2, Files:** the list; upload with progress (register the file with the API,
      then send it to the gateway); scan status (pending, clean, quarantined); download.
      See [Files](#files).
- [ ] **F3, Sharing:** share a file and revoke a share; "shared with me"; the external
      recipient's page (link, emailed code, download), which needs no account.
- [ ] **F4, Administration:** the guard for admin routes (see [Sign-in](#sign-in));
      quarantine (release, rescan); access policies, with the evaluate tool; users and
      groups; the audit log.
- [ ] **F5, Nodes:** enrollment requests with fingerprint confirmation; enrollment
      tokens; TPM registrations; revocation.
- [ ] **F6, Delivery:** the image, published by commit, with the
      Content-Security-Policy (see [The image](#the-image)); deployment by VaultGate's chart
      (VaultGate's M12.5); Playwright and axe against a running VaultGate in CI.

## Known limits

- **No file deletion.** The API has no route for it, so the app doesn't offer it.
- **A failed download shows in the browser's download list,** not in the page: once
  the form is submitted, the page doesn't see the gateway's answer. The intent is asked
  for just before, so a refusal is rare (the scan state changing in between).
