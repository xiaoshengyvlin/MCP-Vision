import test from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod/v4';
import { registerVisionTool } from './registerVisionTool.js';
function stubServer() {
    const registered = [];
    const server = {
        registerTool(name, meta, handler) {
            registered.push({ name, meta, handler });
        }
    };
    return { registered, server };
}
function stubAdapter() {
    const calls = [];
    const adapter = {
        async analyze(input) {
            calls.push(input);
            return { text: 'stub-result', model: input.model ?? 'stub-model', raw: {} };
        }
    };
    return { calls, adapter };
}
test('registerVisionTool forwards prompt, detail, maxTokens, model to adapter', async () => {
    const { registered, server } = stubServer();
    const { calls, adapter } = stubAdapter();
    registerVisionTool(server, adapter, {
        name: 'vision_test',
        title: 'Test tool',
        description: 'desc',
        extraShape: {
            prompt: z.string()
        },
        buildPrompt: (args) => `PREFIX:${args.prompt}`
    });
    assert.equal(registered.length, 1);
    assert.equal(registered[0].name, 'vision_test');
    const result = (await registered[0].handler({
        imageUrl: 'https://example.com/a.png',
        prompt: 'hello',
        model: 'custom-model',
        detail: 'low',
        maxTokens: 321
    }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].prompt, 'PREFIX:hello');
    assert.equal(calls[0].imageUrl, 'https://example.com/a.png');
    assert.equal(calls[0].model, 'custom-model');
    assert.equal(calls[0].detail, 'low');
    assert.equal(calls[0].maxTokens, 321);
    assert.deepEqual(result.content, [{ type: 'text', text: 'stub-result' }]);
    assert.deepEqual(result.structuredContent, {
        text: 'stub-result',
        model: 'custom-model',
        sourceLabel: 'https://example.com/a.png',
        mediaType: 'image/png'
    });
});
test('registerVisionTool passes through optional extra fields (languageHint)', async () => {
    const { registered, server } = stubServer();
    const { calls, adapter } = stubAdapter();
    registerVisionTool(server, adapter, {
        name: 'vision_ocr_test',
        title: 'OCR test',
        description: 'desc',
        extraShape: {
            languageHint: z.string().optional()
        },
        buildPrompt: (args) => `OCR:${args.languageHint ?? 'auto'}`
    });
    await registered[0].handler({
        imageBase64: 'aGVsbG8=',
        imageMediaType: 'image/png',
        languageHint: 'zh-CN'
    });
    assert.equal(calls[0].prompt, 'OCR:zh-CN');
    assert.match(calls[0].imageUrl, /^data:image\/png;base64,aGVsbG8=/);
});
test('registerVisionTool declares a structured output schema', () => {
    const { registered, server } = stubServer();
    const { adapter } = stubAdapter();
    registerVisionTool(server, adapter, {
        name: 'vision_structured_test',
        title: 'Structured test',
        description: 'desc',
        extraShape: {
            prompt: z.string()
        },
        buildPrompt: (args) => args.prompt
    });
    assert.ok(registered[0].meta.outputSchema);
    assert.ok(registered[0].meta.outputSchema.text);
    assert.ok(registered[0].meta.outputSchema.model);
});
test('registerVisionTool uses def.defaultModel when model is not provided', async () => {
    const { registered, server } = stubServer();
    const { calls, adapter } = stubAdapter();
    registerVisionTool(server, adapter, {
        name: 'vision_default_model',
        title: 'Default model test',
        description: 'desc',
        extraShape: {
            prompt: z.string()
        },
        defaultModel: 'ocr-default-model',
        buildPrompt: (args) => args.prompt
    });
    await registered[0].handler({
        imageUrl: 'https://example.com/a.png',
        prompt: 'hello'
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, 'ocr-default-model');
});
test('registerVisionTool prefers explicit model over def.defaultModel', async () => {
    const { registered, server } = stubServer();
    const { calls, adapter } = stubAdapter();
    registerVisionTool(server, adapter, {
        name: 'vision_explicit_model',
        title: 'Explicit model test',
        description: 'desc',
        extraShape: {
            prompt: z.string()
        },
        defaultModel: 'default-model',
        buildPrompt: (args) => args.prompt
    });
    await registered[0].handler({
        imageUrl: 'https://example.com/a.png',
        prompt: 'hello',
        model: 'explicit-model'
    });
    assert.equal(calls[0].model, 'explicit-model');
});
test('registerVisionTool surfaces loadImageInput failures', async () => {
    const { registered, server } = stubServer();
    const { adapter } = stubAdapter();
    registerVisionTool(server, adapter, {
        name: 'vision_err',
        title: 'err',
        description: 'd',
        extraShape: {
            prompt: z.string()
        },
        buildPrompt: (args) => args.prompt
    });
    await assert.rejects(registered[0].handler({ prompt: 'x' }), /Exactly one of imagePath, imageUrl, or imageBase64 must be provided/);
});
