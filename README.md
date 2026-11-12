# vaultgate-frontend

The web frontend of [VaultGate](https://github.com/flaviocavalcantet/vaultgate), the
secure file vault: React and TypeScript, built with Vite.

The plan, the stack and the reasons behind them are in
**[docs/architecture.md](docs/architecture.md)**. So far: the foundation (F0),
sign-in (F1), files (F2: the list, uploads with progress, scan states, downloads),
sharing (F3: links for outside recipients and VaultGate users, Shared with me, the
recipient's page), administration (F4: quarantine, access policies with the
evaluate tool, users, groups and the audit log) and nodes (F5: enrollment requests,
nodes, enrollment tokens and TPM registrations), delivered as an image and tested in
a browser against a real VaultGate (F6).

## Running it

Needs Node 22 or later.

```bash
npm ci
npm run dev        # http://localhost:5173
```

The app reads its settings from `/config.json` when it starts. In development that is
`public/config.json`, which points at VaultGate's local stack (`make up` in the
`vaultgate` repository): the API on 8000, the gateway on 8888 and Keycloak on 8080. Port
5173 is the one VaultGate's local Keycloak client (`vaultgate-web`) allows.

To sign in locally, VaultGate's stack must be running, with this origin allowed to call
the API (`VAULTGATE_CORS_ORIGINS=http://localhost:5173`, which its compose file sets).
The local users are in the `vaultgate` repository's documentation (for example `alice`).

### Against the local cluster, over HTTPS

VaultGate's local Kubernetes cluster (`make k3d-up` in the `vaultgate` repository) serves
everything over HTTPS, and an HTTPS service is best developed against from an `https://`
page, as the app is deployed. For that:

```bash
make dev-cert      # in the vaultgate repository, with its cluster up
npm run dev:k3d    # https://localhost:5173
```

- `make dev-cert` copies the cluster's `localhost` certificate to `~/.vaultgate/dev-tls/`
  (`VAULTGATE_DEV_TLS_DIR` to read it from elsewhere). It is signed by VaultGate's local
  root, which the browser already trusts for the cluster, so there is nothing new to
  trust. It lasts a day like the cluster's other certificates: run `make dev-cert` again,
  and restart the server, when the browser says it has expired.
- The app's settings come from `dev/config.k3d.json`, in place of `public/config.json`:
  the cluster's API, gateway and Keycloak, on the same ports over HTTPS.
- The cluster allows `https://localhost:5173` in the API's and gateway's CORS and in
  Keycloak's `vaultgate-web` client.

## Browser tests

`npm run check` tests the app against a stand-in for the API. The browser tests
(`e2e/`, Playwright and axe) run it against a real VaultGate: they sign in through
Keycloak as the local users, upload files and wait for their scans, share one with an
outside recipient who reads the code from Mailpit, have an administrator release a
quarantined file, open every administration page, and check each page for WCAG 2.1 A
and AA violations with axe.

They run against VaultGate's local cluster (`make k3d-up` in the `vaultgate`
repository), which deploys this app on https://localhost:5174. VaultGate's CI runs them
there on every pull request (`make k3d-browser`). To run them yourself, the browser
must trust VaultGate's local root, as yours does:

```bash
npx playwright install chromium
certutil -d sql:$HOME/.pki/nssdb -A -t C,, -n vaultgate-local -i ~/.vaultgate/pki/root-ca.crt
npm run e2e        # VAULTGATE_E2E_URL for another address, VAULTGATE_E2E_MAILPIT for Mailpit
```

They leave their files and shares behind, under names that start with `e2e-`.

## The image

```bash
docker build -t vaultgate-frontend .
docker run --read-only --tmpfs /tmp -p 8081:8080 \
  -e VAULTGATE_API_URL=http://localhost:8000 \
  -e VAULTGATE_GATEWAY_URL=http://localhost:8888 \
  -e VAULTGATE_OIDC_AUTHORITY=http://localhost:8080/realms/vaultgate \
  vaultgate-frontend
```

The settings, the headers it sends and how it is published:
[docs/architecture.md](docs/architecture.md#the-image). CI publishes it on every merge as
`ghcr.io/flaviocavalcantet/vaultgate-frontend:<commit>`.

## The API's types

```bash
npm run api:types   # regenerate src/api/schema.d.ts from api/openapi.json
npm run api:check   # the same, failing if the result differs from what is committed
```

`api/openapi.json` comes from the `vaultgate` repository (the API serves it at
`/openapi.json`); replace it to take a newer API.

## Checks

```bash
npm run check          # everything below, as CI runs it
npm run typecheck
npm run lint
npm run format:check   # npm run format fixes
npm test
npm run build
```
