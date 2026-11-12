import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin, ServerOptions } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * `npm run dev:k3d` (mode k3d): the development server over HTTPS, against VaultGate's
 * local cluster. The certificate is the cluster's `localhost` one, copied out by
 * `make dev-cert` in the vaultgate repository; the browser trusts it through
 * VaultGate's local root, as it does the cluster's API.
 */
function k3dHttps(): ServerOptions['https'] {
  const dir = process.env.VAULTGATE_DEV_TLS_DIR ?? join(homedir(), '.vaultgate', 'dev-tls')
  try {
    return { cert: readFileSync(join(dir, 'tls.crt')), key: readFileSync(join(dir, 'tls.key')) }
  } catch (cause) {
    throw new Error(
      `No development certificate in ${dir}: run \`make dev-cert\` in the vaultgate repository (its cluster must be up).`,
      { cause },
    )
  }
}

/** Serves dev/config.k3d.json as /config.json, in place of public/config.json. */
function k3dConfig(): Plugin {
  const config = readFileSync(new URL('./dev/config.k3d.json', import.meta.url))
  return {
    name: 'vaultgate-k3d-config',
    configureServer(server) {
      server.middlewares.use('/config.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.end(config)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const k3d = mode === 'k3d'
  return {
    plugins: [react(), tailwindcss(), ...(k3d ? [k3dConfig()] : [])],
    resolve: {
      alias: { '@': new URL('./src', import.meta.url).pathname },
    },
    server: { port: 5173, strictPort: true, ...(k3d ? { https: k3dHttps() } : {}) },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
    },
  }
})
