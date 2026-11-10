import { z } from 'zod'

/**
 * Runtime configuration, read from /config.json when the app starts. It is not baked
 * into the build, so one image serves every environment: the deployment provides the
 * file. Nothing in it is secret (the browser can read all of it).
 */
const url = z.url({ protocol: /^https?$/ }).transform((value) => value.replace(/\/+$/, ''))

export const configSchema = z.object({
  /** The VaultGate API (control plane). */
  apiUrl: url,
  /** The VaultGate gateway (uploads and downloads). */
  gatewayUrl: url,
  /** The OpenID Connect provider: a public client with PKCE. */
  oidc: z.object({
    authority: url,
    clientId: z.string().min(1),
  }),
})

export type Config = z.infer<typeof configSchema>

export class ConfigError extends Error {
  override name = 'ConfigError'
}

export function parseConfig(value: unknown): Config {
  const result = configSchema.safeParse(value)
  if (!result.success) {
    throw new ConfigError(`config.json is not valid: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

export async function loadConfig(fetcher: typeof fetch = fetch): Promise<Config> {
  let response: Response
  try {
    // Never from a cache: a redeployed config must apply on the next load.
    response = await fetcher('/config.json', { cache: 'no-store' })
  } catch (cause) {
    throw new ConfigError('config.json could not be fetched', { cause })
  }
  if (!response.ok) {
    throw new ConfigError(`config.json answered ${response.status}`)
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (cause) {
    throw new ConfigError('config.json is not JSON', { cause })
  }
  return parseConfig(body)
}
