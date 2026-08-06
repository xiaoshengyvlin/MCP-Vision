import test from 'node:test';
import assert from 'node:assert/strict';
import { registerVisionOcrTool } from './visionOcr.js';
function stubServer() {
    const registered = [];
    const server = {
        registerTool(_name, _meta, handler) {
            registered.push({ handler });
        }
    };
    return { registered, server };
}
test('vision_ocr forwards outputFormat into the OCR prompt', async () => {
    const { registered, server } = stubServer();
    const calls = [];
    const adapter = {
        async analyze(input) {
            calls.push(input);
            return { text: 'stub-result', model: 'stub-model', raw: {} };
        }
    };
    registerVisionOcrTool(server, adapter);
    await registered[0].handler({
        imageUrl: 'https://example.com/receipt.png',
        languageHint: 'en',
        outputFormat: 'markdown'
    });
    assert.match(calls[0].prompt, /Known language preference: en/);
    assert.match(calls[0].prompt, /Output format: Markdown/);
});
test('vision_ocr uses its default model when model is absent', async () => {
    const { registered, server } = stubServer();
    const calls = [];
    const adapter = {
        async analyze(input) {
            calls.push(input);
            return { text: 'stub-result', model: 'stub-model', raw: {} };
        }
    };
    registerVisionOcrTool(server, adapter, 'ocr-default-model');
    await registered[0].handler({
        imageUrl: 'https://example.com/receipt.png'
    });
    assert.equal(calls[0].model, 'ocr-default-model');
});
