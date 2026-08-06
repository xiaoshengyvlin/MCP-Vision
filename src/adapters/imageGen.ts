import { safeParseJson, truncate, withTrailingSlash, wrapFetchError } from './openaiCompatible.js'

const DOWNLOAD_TIMEOUT_MS = 30000
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

export interface ImageGenConfig {
  apiBaseUrl?: string
  apiPath: string
  apiKey?: string
  defaultModel?: string
  timeoutMs: number
}

export interface ImageGenInput {
  prompt: string
  model?: string
  size?: string
  n?: number
}

export interface GeneratedImage {
  base64?: string
  mediaType?: string
  url?: string
}

export interface ImageGenResult {
  model: string
  images: GeneratedImage[]
  raw: unknown
}

interface ImageGenResponse {
  data?: Array<{
    b64_json?: string
    url?: string
  }>
  error?: {
    message?: string
  }
}

export class OpenAICompatibleImageGenAdapter {
  constructor(private readonly config: ImageGenConfig) {}

  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    if (!this.config.apiBaseUrl) {
      throw new Error('IMAGE_API_BASE_URL / VISION_API_BASE_URL 未配置')
    }
    const model = input.model || this.config.defaultModel
    if (!model) {
      throw new Error('IMAGE_MODEL / VISION_MODEL 未配置，且工具调用未传入 model')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    const url = new URL(this.config.apiPath, withTrailingSlash(this.config.apiBaseUrl)).toString()

    try {
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {})
          },
          body: JSON.stringify({
            model,
            prompt: input.prompt,
            ...(input.size ? { size: input.size } : {}),
            ...(input.n ? { n: input.n } : {})
          }),
          signal: controller.signal
        })
      } catch (error) {
        throw wrapFetchError(error, this.config.timeoutMs, '生图模型')
      }

      const bodyText = await response.text()
      const data = safeParseJson(bodyText) as ImageGenResponse | null

      if (!response.ok) {
        const upstreamMessage = data?.error?.message
        if (upstreamMessage) {
          throw new Error(`上游生图模型请求失败 (HTTP ${response.status}): ${truncate(upstreamMessage, 200)}`)
        }
        throw new Error(`上游生图模型请求失败 (HTTP ${response.status}): ${truncate(bodyText, 200)}`)
      }

      if (!data || !Array.isArray(data.data)) {
        throw new Error(`上游生图响应缺少图片数据: ${truncate(bodyText, 200)}`)
      }

      const images: GeneratedImage[] = []
      for (const item of data.data) {
        if (typeof item.b64_json === 'string' && item.b64_json.length > 0) {
          images.push({ base64: item.b64_json, mediaType: 'image/png' })
        } else if (typeof item.url === 'string' && item.url.length > 0) {
          const downloaded = await tryDownloadAsBase64(item.url)
          if (downloaded) {
            images.push({ base64: downloaded.base64, mediaType: downloaded.mediaType, url: item.url })
          } else {
            images.push({ url: item.url })
          }
        }
      }

      if (images.length === 0) {
        throw new Error(`上游生图响应缺少图片数据: ${truncate(bodyText, 200)}`)
      }

      return { model, images, raw: data }
    } finally {
      clearTimeout(timer)
    }
  }
}

async function tryDownloadAsBase64(url: string): Promise<{ base64: string; mediaType: string } | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      return null
    }
    const contentType = response.headers.get('content-type') || ''
    const mediaType = contentType.split(';', 1)[0].trim().toLowerCase()
    if (!mediaType.startsWith('image/')) {
      return null
    }

    const reader = response.body?.getReader()
    if (!reader) {
      return null
    }
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      total += value.byteLength
      if (total > MAX_DOWNLOAD_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    if (total === 0) {
      return null
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    return { base64: buffer.toString('base64'), mediaType: mediaType || 'image/png' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
