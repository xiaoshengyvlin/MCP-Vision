import * as z from 'zod/v4';
import { buildAnalyzePrompt } from '../core/prompts.js';
import { registerVisionTool } from './registerVisionTool.js';
export function registerVisionAnalyzeTool(server, adapter, defaultModel) {
    registerVisionTool(server, adapter, {
        name: 'vision_analyze',
        title: 'Analyze an image with a vision model',
        description: 'Understand, explain, or describe an image using a vision model. Use for interpreting screenshots, UI, diagrams, charts, or error messages that need reasoning. Not for verbatim text extraction (use vision_ocr).',
        extraShape: {
            prompt: z.string().min(1).describe('Instruction passed to the vision model.')
        },
        defaultModel,
        buildPrompt: (args) => buildAnalyzePrompt(args.prompt)
    });
}
