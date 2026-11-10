# vaultgate-frontend

The web frontend of [VaultGate](https://github.com/flaviocavalcantet/vaultgate), the
secure file vault: React and TypeScript, built with Vite.

The plan, the stack and the reasons behind them are in
**[docs/architecture.md](docs/architecture.md)**. So far the foundation is in place
(F0): the app's frame, runtime configuration, and the tooling. Sign-in is next.

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

## Checks

```bash
npm run check          # everything below, as CI runs it
npm run typecheck
npm run lint
npm run format:check   # npm run format fixes
npm test
npm run build
```
