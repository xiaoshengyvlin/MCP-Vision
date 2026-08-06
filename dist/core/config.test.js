import test from 'node:test';
import assert from 'node:assert/strict';
import { getHelpText, getImageGenConfig, getRuntimeConfig, isHelpRequested } from './config.js';
const ENV_KEYS = [
    'VISION_API_BASE_URL',
    'VISION_API_PATH',
    'VISION_API_KEY',
    'VISION_MODEL',
    'VISION_ANALYZE_MODEL',
    'VISION_BACKUP_API_BASE_URL',
    'VISION_BACKUP_API_PATH',
    'VISION_BACKUP_API_KEY',
    'VISION_BACKUP_MODEL',
    'VISION_TIMEOUT_MS',
    'VISION_MAX_TOKENS',
    'IMAGE_API_BASE_URL',
    'IMAGE_API_PATH',
    'IMAGE_API_KEY',
    'IMAGE_MODEL',
    'IMAGE_TIMEOUT_MS',
    'MCP_SERVER_NAME',
    'MCP_SERVER_VERSION'
];
function withCleanEnv(fn, overrides = {}) {
    const backup = {};
    for (const key of ENV_KEYS) {
        backup[key] = process.env[key];
        delete process.env[key];
    }
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete process.env[key];
        }
        else {
            process.env[key] = value;
        }
    }
    try {
        return fn();
    }
    finally {
        for (const key of ENV_KEYS) {
            if (backup[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = backup[key];
            }
        }
    }
}
test('getRuntimeConfig parses inline --flag=value form', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig(['--api-base-url=https://inline.example.com', '--model=gpt-inline']);
        assert.equal(config.apiBaseUrl, 'https://inline.example.com');
        assert.equal(config.defaultModel, 'gpt-inline');
    });
});
test('getRuntimeConfig parses separated --flag value form', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig(['--api-base-url', 'https://sep.example.com', '--model', 'gpt-sep']);
        assert.equal(config.apiBaseUrl, 'https://sep.example.com');
        assert.equal(config.defaultModel, 'gpt-sep');
    });
});
test('getRuntimeConfig falls back to environment variables when argv is empty', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.apiBaseUrl, 'https://env.example.com');
        assert.equal(config.defaultModel, 'gpt-env');
        assert.equal(config.apiKey, 'sk-env');
        assert.equal(config.timeoutMs, 1234);
        assert.equal(config.maxTokens, 8192);
    }, {
        VISION_API_BASE_URL: 'https://env.example.com',
        VISION_MODEL: 'gpt-env',
        VISION_API_KEY: 'sk-env',
        VISION_TIMEOUT_MS: '1234',
        VISION_MAX_TOKENS: '8192'
    });
});
test('getRuntimeConfig prefers CLI over environment', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig(['--api-base-url=https://cli.example.com', '--model=cli-model']);
        assert.equal(config.apiBaseUrl, 'https://cli.example.com');
        assert.equal(config.defaultModel, 'cli-model');
    }, {
        VISION_API_BASE_URL: 'https://env.example.com',
        VISION_MODEL: 'env-model'
    });
});
test('getRuntimeConfig accepts --vision-* alias flags', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([
            '--vision-api-base-url=https://alias.example.com',
            '--vision-model=alias-model',
            '--vision-max-tokens=7777'
        ]);
        assert.equal(config.apiBaseUrl, 'https://alias.example.com');
        assert.equal(config.defaultModel, 'alias-model');
        assert.equal(config.maxTokens, 7777);
    });
});
test('getRuntimeConfig parses --max-tokens and prefers CLI over environment', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([
            '--api-base-url=https://cli.example.com',
            '--model=cli-model',
            '--max-tokens',
            '6144'
        ]);
        assert.equal(config.maxTokens, 6144);
    }, {
        VISION_MAX_TOKENS: '2048'
    });
});
test('getRuntimeConfig tolerates missing apiBaseUrl for placeholder setup', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig(['--model=only-model']);
        assert.equal(config.apiBaseUrl, undefined);
        assert.equal(config.defaultModel, 'only-model');
    });
});
test('getRuntimeConfig tolerates missing defaultModel for placeholder setup', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig(['--api-base-url=https://x.example.com']);
        assert.equal(config.defaultModel, undefined);
        assert.equal(config.apiBaseUrl, 'https://x.example.com');
    });
});
test('getImageGenConfig falls back to VISION_* values and default path', () => {
    withCleanEnv(() => {
        const config = getImageGenConfig();
        assert.equal(config.apiBaseUrl, 'https://env.example.com');
        assert.equal(config.defaultModel, 'gpt-env');
        assert.equal(config.apiKey, 'sk-env');
        assert.equal(config.apiPath, '/v1/images/generations');
        assert.equal(config.timeoutMs, 120000);
    }, {
        VISION_API_BASE_URL: 'https://env.example.com',
        VISION_MODEL: 'gpt-env',
        VISION_API_KEY: 'sk-env'
    });
});
test('getImageGenConfig prefers IMAGE_* over VISION_*', () => {
    withCleanEnv(() => {
        const config = getImageGenConfig();
        assert.equal(config.apiBaseUrl, 'https://img.example.com');
        assert.equal(config.defaultModel, 'img-model');
    }, {
        VISION_API_BASE_URL: 'https://env.example.com',
        VISION_MODEL: 'gpt-env',
        IMAGE_API_BASE_URL: 'https://img.example.com',
        IMAGE_MODEL: 'img-model'
    });
});
test('getRuntimeConfig reads per-tool model overrides', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.defaultModel, 'base-model');
        assert.equal(config.visionAnalyzeModel, 'analyze-model');
        assert.equal(config.visionBackupModel, 'ocr-model');
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_MODEL: 'base-model',
        VISION_ANALYZE_MODEL: 'analyze-model',
        VISION_BACKUP_MODEL: 'ocr-model'
    });
});
test('getRuntimeConfig leaves per-tool model overrides unset when env is missing', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.defaultModel, 'base-model');
        assert.equal(config.visionAnalyzeModel, undefined);
        assert.equal(config.visionBackupModel, undefined);
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_MODEL: 'base-model'
    });
});
test('getRuntimeConfig resolves a dedicated backup endpoint', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.visionBackupApiBaseUrl, 'https://ocr.example.com');
        assert.equal(config.visionBackupApiPath, '/v1/chat/completions');
        assert.equal(config.visionBackupApiKey, 'sk-ocr');
        assert.equal(config.visionBackupModel, 'ocr-model');
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_API_KEY: 'sk-main',
        VISION_MODEL: 'main-model',
        VISION_BACKUP_API_BASE_URL: 'https://ocr.example.com',
        VISION_BACKUP_API_KEY: 'sk-ocr',
        VISION_BACKUP_MODEL: 'ocr-model'
    });
});
test('getRuntimeConfig falls backup endpoint back to VISION_* when unset', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.visionBackupApiBaseUrl, 'https://x.example.com');
        assert.equal(config.visionBackupApiKey, 'sk-main');
        assert.equal(config.visionBackupModel, undefined);
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_API_KEY: 'sk-main',
        VISION_MODEL: 'main-model'
    });
});
test('getRuntimeConfig falls back to default when VISION_TIMEOUT_MS is not a positive number', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.timeoutMs, 60000);
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_MODEL: 'm',
        VISION_TIMEOUT_MS: 'not-a-number'
    });
});
test('getRuntimeConfig falls back to default when VISION_MAX_TOKENS is not a positive number', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.maxTokens, 4096);
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_MODEL: 'm',
        VISION_MAX_TOKENS: 'not-a-number'
    });
});
test('getRuntimeConfig uses defaults for apiPath, serverName, serverVersion when unspecified', () => {
    withCleanEnv(() => {
        const config = getRuntimeConfig([]);
        assert.equal(config.apiPath, '/v1/chat/completions');
        assert.equal(config.maxTokens, 4096);
        assert.equal(config.serverName, 'mcp-vision-server');
        assert.equal(config.serverVersion, '0.1.4');
    }, {
        VISION_API_BASE_URL: 'https://x.example.com',
        VISION_MODEL: 'm'
    });
});
test('isHelpRequested detects --help and -h', () => {
    assert.equal(isHelpRequested(['--help']), true);
    assert.equal(isHelpRequested(['-h']), true);
    assert.equal(isHelpRequested(['--model', 'x']), false);
});
test('getHelpText mentions all main options', () => {
    const text = getHelpText();
    assert.match(text, /--api-base-url/);
    assert.match(text, /--api-path/);
    assert.match(text, /--api-key/);
    assert.match(text, /--model/);
    assert.match(text, /--timeout-ms/);
    assert.match(text, /--max-tokens/);
    assert.match(text, /VISION_API_BASE_URL/);
    assert.match(text, /VISION_MAX_TOKENS/);
});
