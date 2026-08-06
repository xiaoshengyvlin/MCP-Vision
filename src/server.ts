#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import {
  createImageGenAdapter,
  createVisionAdapter,
  getHelpText,
  getImageGenConfig,
  getRuntimeConfig,
  getServerMeta,
  isHelpRequested
} from './core/config.js'
import { registerImageGenerateTool } from './tools/imageGenerate.js'
import { registerVisionAnalyzeTool } from './tools/visionAnalyze.js'
import { registerVisionOcrTool } from './tools/visionOcr.js'

async function main() {
  if (isHelpRequested()) {
    console.error(getHelpText())
    return
  }

  const runtimeConfig = getRuntimeConfig()
  const imageGenConfig = getImageGenConfig()
  const meta = getServerMeta(runtimeConfig)
  const adapter = createVisionAdapter(runtimeConfig)
  const backupAdapter = createVisionAdapter({
    apiBaseUrl: runtimeConfig.visionBackupApiBaseUrl,
    apiPath: runtimeConfig.visionBackupApiPath,
    apiKey: runtimeConfig.visionBackupApiKey,
    defaultModel: runtimeConfig.visionBackupModel ?? runtimeConfig.defaultModel,
    timeoutMs: runtimeConfig.timeoutMs,
    maxTokens: runtimeConfig.maxTokens
  })
  const imageGenAdapter = createImageGenAdapter(imageGenConfig)
  const server = new McpServer(meta, {
    capabilities: {
      logging: {}
    },
    instructions: [
      'Use vision_analyze for understanding, explaining, or describing images.',
      'Use vision_ocr for extracting exact text from images (code, terminal output, documents, screenshots).',
      'Use image_generate to create new images from a text prompt.',
      'Prefer imagePath for local files.',
      'Use imageUrl for remote URLs, data URLs, or file URLs.',
      'Use imageBase64 with imageMediaType when the client can forward uploaded attachment bytes.'
    ].join(' ')
  })

  registerVisionAnalyzeTool(server, adapter, runtimeConfig.visionAnalyzeModel)
  registerVisionOcrTool(server, backupAdapter)
  registerImageGenerateTool(server, imageGenAdapter)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(
    `${meta.name} v${meta.version} running on stdio ` +
      `(vision: ${runtimeConfig.apiBaseUrl ?? 'unset'}/${runtimeConfig.defaultModel ?? 'unset'}, ` +
      `imageGen: ${imageGenConfig.apiBaseUrl ?? 'unset'}/${imageGenConfig.defaultModel ?? 'unset'})`
  )
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
