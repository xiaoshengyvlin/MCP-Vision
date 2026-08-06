import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleImageGenAdapter } from '../adapters/imageGen.js'

export function registerImageGenerateTool(server: McpServer, adapter: OpenAICompatibleImageGenAdapter): void {
  server.registerTool(
    'image_generate',
    {
      title: 'Generate images',
      description:
        'Generate one or more images from a text prompt through an OpenAI-compatible images/generations endpoint. Images are returned inline as base64 when available, otherwise as download URLs.',
      inputSchema: z.object({
        prompt: z.string().min(1).describe('Text description of the image to generate.'),
        model: z.string().min(1).optional().describe('Optional model override.'),
        size: z.string().optional().describe('Optional image size such as 1024x1024.'),
        n: z.number().int().min(1).max(4).optional().describe('Optional number of images to generate (1-4).')
      }),
      outputSchema: z.object({
        text: z.string().describe('Description of the generated images.'),
        model: z.string().describe('Model used for the request.'),
        count: z.number().int().describe('Number of images generated.')
      })
    },
    async (args) => {
      const result = await adapter.generate({
        prompt: args.prompt,
        model: args.model,
        size: args.size,
        n: args.n
      })

      const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = []
      for (const image of result.images) {
        if (image.base64) {
          content.push({ type: 'image', data: image.base64, mimeType: image.mediaType ?? 'image/png' })
        } else if (image.url) {
          content.push({ type: 'text', text: `Generated image URL: ${image.url}` })
        }
      }

      const allInline = result.images.every((image) => image.base64)
      const text = result.images.length > 0 && allInline
        ? `Generated ${result.images.length} image(s) inline as base64.`
        : `Generated ${result.images.length} image(s).`

      return {
        content,
        structuredContent: {
          text,
          model: result.model,
          count: result.images.length
        }
      }
    }
  )
}
