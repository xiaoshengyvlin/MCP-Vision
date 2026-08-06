import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { buildAnalyzePrompt } from '../core/prompts.js'
import { registerVisionTool } from './registerVisionTool.js'

export function registerVisionAnalyzeTool(
  server: McpServer,
  adapter: OpenAICompatibleVisionAdapter,
  defaultModel?: string
) {
  registerVisionTool(server, adapter, {
    name: 'vision_analyze',
    title: 'Analyze an image with a vision model',
    description:
      'Understand, explain, or describe an image using a vision model. Use for interpreting screenshots, UI, diagrams, charts, or error messages that need reasoning. Not for verbatim text extraction (use vision_ocr).',
    extraShape: {
      prompt: z.string().min(1).describe('Instruction passed to the vision model.')
    },
    defaultModel,
    buildPrompt: (args) => buildAnalyzePrompt(args.prompt as string)
  })
}
