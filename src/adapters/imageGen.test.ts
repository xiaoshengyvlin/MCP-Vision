import test from 'node:test'
import assert from 'node:assert/strict'

import { OpenAICompatibleImageGenAdapter } from './imageGen.js'

function createAdapter(overrides: Partial<ConstructorParameters<typeof OpenAICompatibleImageGenAdapter>[0]> = {}) {
  return new OpenAICompatibleImageGenAdapter({
    apiBaseUrl: 'https://example.com',
    apiPath: '/v1/images/generations',
    apiKey: 'sk-test',
    defaultModel: 'image-model',
    timeoutMs: 50,
    ...overrides
  })
}

async function withStubFetch<T>(
  impl: (url: string, init: RequestInit) => Promise<Response>,
  run: () => Promise<T>
): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

test('generate returns inline base64 when upstream provides b64_json', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async (_url, init) => {
      assert.equal((JSON.parse(init.body as string) as { prompt: string }).prompt, 'a red fox')
      return new Response(
        JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
    async () => {
      const result = await adapter.generate({ prompt: 'a red fox' })
      assert.equal(result.images.length, 1)
      assert.equal(result.images[0].base64, 'aGVsbG8=')
      assert.equal(result.images[0].mediaType, 'image/png')
      assert.equal(result.model, 'image-model')
    }
  )
})

test('generate returns every image when upstream returns multiple', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async () =>
      new Response(
        JSON.stringify({ data: [{ b64_json: 'YQ==' }, { b64_json: 'Yg==' }, { b64_json: 'Yw==' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
    async () => {
      const result = await adapter.generate({ prompt: 'three foxes', n: 3 })
      assert.equal(result.images.length, 3)
      assert.deepEqual(result.images.map((img) => img.base64), ['YQ==', 'Yg==', 'Yw=='])
    }
  )
})

test('generate downloads a URL and converts it to base64', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async (url) => {
      if (url.startsWith('https://example.com/v1/images')) {
        return new Response(
          JSON.stringify({ data: [{ url: 'https://cdn.example.com/img.png' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(Buffer.from('png-bytes'), { status: 200, headers: { 'content-type': 'image/png' } })
    },
    async () => {
      const result = await adapter.generate({ prompt: 'a red fox' })
      assert.equal(result.images.length, 1)
      assert.equal(result.images[0].base64, Buffer.from('png-bytes').toString('base64'))
      assert.equal(result.images[0].mediaType, 'image/png')
    }
  )
})

test('generate falls back to the URL when the image download fails', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async (url) => {
      if (url.startsWith('https://example.com/v1/images')) {
        return new Response(
          JSON.stringify({ data: [{ url: 'https://cdn.example.com/img.png' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      throw new TypeError('fetch failed: ENOTFOUND')
    },
    async () => {
      const result = await adapter.generate({ prompt: 'a red fox' })
      assert.equal(result.images.length, 1)
      assert.equal(result.images[0].url, 'https://cdn.example.com/img.png')
      assert.equal(result.images[0].base64, undefined)
    }
  )
})

test('generate does not download non-http(s) image URLs', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async (_url, init) => {
      const body = JSON.parse(init.body as string) as { prompt: string }
      if (body.prompt === 'file') {
        return new Response(
          JSON.stringify({ data: [{ url: 'file:///C:/x.png' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({ data: [{ url: 'ftp://example.com/x.png' }] }), { status: 200 })
    },
    async () => {
      const fileResult = await adapter.generate({ prompt: 'file' })
      assert.equal(fileResult.images[0].url, 'file:///C:/x.png')
      assert.equal(fileResult.images[0].base64, undefined)

      const ftpResult = await adapter.generate({ prompt: 'ftp' })
      assert.equal(ftpResult.images[0].url, 'ftp://example.com/x.png')
      assert.equal(ftpResult.images[0].base64, undefined)
    }
  )
})

test('generate does not treat non-image content-type as a valid download', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async (url) => {
      if (url.startsWith('https://example.com/v1/images')) {
        return new Response(
          JSON.stringify({ data: [{ url: 'https://cdn.example.com/error' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('<html>error</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    },
    async () => {
      const result = await adapter.generate({ prompt: 'a red fox' })
      assert.equal(result.images.length, 1)
      assert.equal(result.images[0].url, 'https://cdn.example.com/error')
      assert.equal(result.images[0].base64, undefined)
    }
  )
})

test('generate surfaces upstream error.message on failure', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async () =>
      new Response(JSON.stringify({ error: { message: 'billing issue' } }), {
        status: 402,
        headers: { 'content-type': 'application/json' }
      }),
    async () => {
      await assert.rejects(adapter.generate({ prompt: 'x' }), /HTTP 402.*billing issue/s)
    }
  )
})

test('generate rejects when configuration is missing', async () => {
  const adapter = createAdapter({ apiBaseUrl: undefined })
  await assert.rejects(adapter.generate({ prompt: 'x' }), /IMAGE_API_BASE_URL/)
})
