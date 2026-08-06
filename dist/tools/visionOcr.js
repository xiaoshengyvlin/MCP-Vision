import * as z from 'zod/v4';
import { buildOcrPrompt } from '../core/prompts.js';
import { registerVisionTool } from './registerVisionTool.js';
export function registerVisionOcrTool(server, adapter, defaultModel) {
    registerVisionTool(server, adapter, {
        name: 'vision_ocr',
        title: 'Extract text from an image',
        description: 'Extract exact text from an image (OCR). Use when the user wants literal text copied verbatim from a screenshot, code image, terminal output, document, or receipt. Not for explaining or understanding images (use vision_analyze).',
        extraShape: {
            languageHint: z.string().min(1).optional().describe('Optional language hint such as zh-CN or en.'),
            outputFormat: z
                .enum(['plain', 'markdown', 'json'])
                .optional()
                .describe('Preferred OCR output format. Defaults to plain.')
        },
        defaultModel,
        buildPrompt: (args) => buildOcrPrompt(args.languageHint, args.outputFormat ?? 'plain')
    });
}
