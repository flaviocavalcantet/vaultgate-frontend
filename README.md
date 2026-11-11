# vaultgate-frontend

The web frontend of [VaultGate](https://github.com/flaviocavalcantet/vaultgate), the
secure file vault: React and TypeScript, built with Vite.

The plan, the stack and the reasons behind them are in
**[docs/architecture.md](docs/architecture.md)**. So far: the foundation (F0),
sign-in (F1) and files (F2: the list, uploads with progress, scan states, downloads).
Sharing is next.

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
