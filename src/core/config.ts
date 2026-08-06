import { OpenAICompatibleImageGenAdapter } from '../adapters/imageGen.js'
import { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'

interface RuntimeConfig {
  apiBaseUrl?: string
  apiPath: string
  apiKey?: string
  defaultModel?: string
  visionAnalyzeModel?: string
  visionBackupApiBaseUrl?: string
  visionBackupApiPath: string
  visionBackupApiKey?: string
  visionBackupModel?: string
  timeoutMs: number
  maxTokens: number
  serverName: string
  serverVersion: string
}

export interface ImageGenConfig {
  apiBaseUrl?: string
  apiPath: string
  apiKey?: string
  defaultModel?: string
  timeoutMs: number
}

interface CliOptions {
  apiBaseUrl?: string
  apiPath?: string
  apiKey?: string
  defaultModel?: string
  timeoutMs?: number
  maxTokens?: number
  serverName?: string
  serverVersion?: string
  helpRequested: boolean
}

function requireValue(name: string, value?: string): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(`缺少配置项 ${name}`)
  }
  return trimmed
}

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim()
}

function readNumberValue(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = { helpRequested: false }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.helpRequested = true
      continue
    }

    const [flag, inlineValue] = arg.split('=', 2)
    const nextValue = inlineValue ?? argv[index + 1]

    const consumeValue = () => {
      if (inlineValue === undefined) {
        index += 1
      }
      return requireValue(flag, nextValue)
    }

    switch (flag) {
      case '--api-base-url':
      case '--vision-api-base-url':
        options.apiBaseUrl = consumeValue()
        break
      case '--api-path':
      case '--vision-api-path':
        options.apiPath = consumeValue()
        break
      case '--api-key':
      case '--vision-api-key':
        options.apiKey = consumeValue()
        break
      case '--model':
      case '--vision-model':
        options.defaultModel = consumeValue()
        break
      case '--timeout-ms':
      case '--vision-timeout-ms':
        options.timeoutMs = readNumberValue(consumeValue(), 60000)
        break
      case '--max-tokens':
      case '--vision-max-tokens':
        options.maxTokens = readNumberValue(consumeValue(), 4096)
        break
      case '--server-name':
      case '--mcp-server-name':
        options.serverName = consumeValue()
        break
      case '--server-version':
      case '--mcp-server-version':
        options.serverVersion = consumeValue()
        break
      default:
        break
    }
  }

  return options
}

export function isHelpRequested(argv = process.argv.slice(2)): boolean {
  return parseCliArgs(argv).helpRequested
}

export function getHelpText(): string {
  return [
    'mcp-vision-server',
    '',
    'Usage:',
    '  node dist/server.js [options]',
    '',
    'Options:',
    '  --api-base-url <url>      上游视觉模型 API 根地址',
    '  --api-path <path>         上游 API 路径，默认 /v1/chat/completions',
    '  --api-key <key>           上游 API Key',
    '  --model <name>            默认视觉模型名',
    '  --timeout-ms <ms>         请求超时，默认 60000',
    '  --max-tokens <n>          默认 max_tokens，默认 4096',
    '  --server-name <name>      MCP server 名称',
    '  --server-version <ver>    MCP server 版本',
    '  -h, --help                显示帮助',
    '',
    'Priority:',
    '  CLI 参数 > 环境变量 > 默认值',
    '',
    'Environment fallback:',
    '  VISION_API_BASE_URL, VISION_API_PATH, VISION_API_KEY, VISION_MODEL, VISION_TIMEOUT_MS, VISION_MAX_TOKENS',
    '  VISION_ANALYZE_MODEL (override analyze default model, falls back to VISION_MODEL)',
    '  VISION_BACKUP_API_BASE_URL, VISION_BACKUP_API_PATH, VISION_BACKUP_API_KEY, VISION_BACKUP_MODEL',
    '  (dedicated backup vision endpoint for vision_ocr, each falls back to the matching VISION_* value when unset)',
    '',
    'Image generation (image_generate):',
    '  IMAGE_API_BASE_URL, IMAGE_API_PATH, IMAGE_API_KEY, IMAGE_MODEL, IMAGE_TIMEOUT_MS',
    '  Each IMAGE_* value falls back to the matching VISION_* value when unset.'
  ].join('\n')
}

export function getRuntimeConfig(argv = process.argv.slice(2)): RuntimeConfig {
  const cli = parseCliArgs(argv)

  return {
    apiBaseUrl: cli.apiBaseUrl || readEnv('VISION_API_BASE_URL'),
    apiPath: cli.apiPath || readEnv('VISION_API_PATH') || '/v1/chat/completions',
    apiKey: cli.apiKey || readEnv('VISION_API_KEY'),
    defaultModel: cli.defaultModel || readEnv('VISION_MODEL'),
    visionAnalyzeModel: readEnv('VISION_ANALYZE_MODEL'),
    visionBackupApiBaseUrl:
      readEnv('VISION_BACKUP_API_BASE_URL') || cli.apiBaseUrl || readEnv('VISION_API_BASE_URL'),
    visionBackupApiPath:
      readEnv('VISION_BACKUP_API_PATH') || cli.apiPath || readEnv('VISION_API_PATH') || '/v1/chat/completions',
    visionBackupApiKey: readEnv('VISION_BACKUP_API_KEY') || cli.apiKey || readEnv('VISION_API_KEY'),
    visionBackupModel: readEnv('VISION_BACKUP_MODEL'),
    timeoutMs: cli.timeoutMs || readNumberValue(readEnv('VISION_TIMEOUT_MS'), 60000),
    maxTokens: cli.maxTokens || readNumberValue(readEnv('VISION_MAX_TOKENS'), 4096),
    serverName: cli.serverName || readEnv('MCP_SERVER_NAME') || 'mcp-vision-server',
    serverVersion: cli.serverVersion || readEnv('MCP_SERVER_VERSION') || '0.1.4'
  }
}

export function getImageGenConfig(): ImageGenConfig {
  return {
    apiBaseUrl: readEnv('IMAGE_API_BASE_URL') || readEnv('VISION_API_BASE_URL'),
    apiPath: readEnv('IMAGE_API_PATH') || '/v1/images/generations',
    apiKey: readEnv('IMAGE_API_KEY') || readEnv('VISION_API_KEY'),
    defaultModel: readEnv('IMAGE_MODEL') || readEnv('VISION_MODEL'),
    timeoutMs: readNumberValue(readEnv('IMAGE_TIMEOUT_MS'), 120000)
  }
}

type VisionAdapterConfig = Pick<
  RuntimeConfig,
  'apiBaseUrl' | 'apiPath' | 'apiKey' | 'defaultModel' | 'timeoutMs' | 'maxTokens'
>

export function createVisionAdapter(config: VisionAdapterConfig = getRuntimeConfig()) {
  return new OpenAICompatibleVisionAdapter({
    apiBaseUrl: config.apiBaseUrl,
    apiPath: config.apiPath,
    apiKey: config.apiKey,
    defaultModel: config.defaultModel,
    timeoutMs: config.timeoutMs,
    maxTokens: config.maxTokens
  })
}

export function createImageGenAdapter(config = getImageGenConfig()) {
  return new OpenAICompatibleImageGenAdapter(config)
}

export function getServerMeta(config = getRuntimeConfig()) {
  return {
    name: config.serverName,
    version: config.serverVersion
  }
}
