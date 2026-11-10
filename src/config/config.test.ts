import { ConfigError, loadConfig, parseConfig } from './config'

const valid = {
  apiUrl: 'https://api.example.test/',
  gatewayUrl: 'https://gateway.example.test',
  oidc: { authority: 'https://sso.example.test/realms/vaultgate/', clientId: 'vaultgate-web' },
}

const answering = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response)

describe('parseConfig', () => {
  it('accepts a valid config and drops trailing slashes', () => {
    expect(parseConfig(valid)).toEqual({
      apiUrl: 'https://api.example.test',
      gatewayUrl: 'https://gateway.example.test',
      oidc: { authority: 'https://sso.example.test/realms/vaultgate', clientId: 'vaultgate-web' },
    })
  })

  it.each([
    ['a missing gateway', { ...valid, gatewayUrl: undefined }],
    ['an address that is not http(s)', { ...valid, apiUrl: 'javascript:alert(1)' }],
    ['an empty client', { ...valid, oidc: { ...valid.oidc, clientId: '' } }],
    ['something that is not an object', 'nope'],
  ])('refuses %s', (_name, value) => {
    expect(() => parseConfig(value)).toThrow(ConfigError)
  })
})

describe('loadConfig', () => {
  it('fetches /config.json without the cache', async () => {
    const fetcher = answering(Response.json(valid))
    await expect(loadConfig(fetcher)).resolves.toMatchObject({ gatewayUrl: valid.gatewayUrl })
    expect(fetcher).toHaveBeenCalledWith('/config.json', { cache: 'no-store' })
  })

  it('fails when the file is missing', async () => {
    const fetcher = answering(new Response('not found', { status: 404 }))
    await expect(loadConfig(fetcher)).rejects.toThrow('config.json answered 404')
  })

  it('fails when the file is not JSON', async () => {
    const fetcher = answering(new Response('<html>'))
    await expect(loadConfig(fetcher)).rejects.toThrow('config.json is not JSON')
  })

  it('fails when the request does', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))
    await expect(loadConfig(fetcher)).rejects.toThrow('config.json could not be fetched')
  })
})
