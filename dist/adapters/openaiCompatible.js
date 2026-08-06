export class OpenAICompatibleVisionAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    async analyze(input) {
        if (!this.config.apiBaseUrl) {
            throw new Error('VISION_API_BASE_URL 未配置');
        }
        const model = input.model || this.config.defaultModel;
        if (!model) {
            throw new Error('VISION_MODEL 未配置，且工具调用未传入 model');
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const url = new URL(this.config.apiPath, withTrailingSlash(this.config.apiBaseUrl)).toString();
        try {
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {})
                    },
                    body: JSON.stringify({
                        model,
                        max_tokens: input.maxTokens ?? this.config.maxTokens,
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: input.prompt },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: input.imageUrl,
                                            ...(input.detail ? { detail: input.detail } : {})
                                        }
                                    }
                                ]
                            }
                        ]
                    }),
                    signal: controller.signal
                });
            }
            catch (error) {
                throw wrapFetchError(error, this.config.timeoutMs);
            }
            const bodyText = await response.text();
            const data = safeParseJson(bodyText);
            if (!response.ok) {
                const upstreamMessage = data?.error?.message;
                const summary = truncate(bodyText, 200);
                if (upstreamMessage) {
                    throw new Error(`上游视觉模型请求失败 (HTTP ${response.status}): ${truncate(upstreamMessage, 200)}`);
                }
                throw new Error(`上游视觉模型请求失败 (HTTP ${response.status}): ${summary}`);
            }
            if (!data) {
                throw new Error(`上游返回非 JSON 响应 (HTTP ${response.status}): ${truncate(bodyText, 200)}`);
            }
            const text = normalizeContent(data);
            if (!text) {
                throw new Error('上游视觉模型返回为空，无法提取识别结果');
            }
            return { text, model, raw: data };
        }
        finally {
            clearTimeout(timer);
        }
    }
}
export function normalizeContent(data) {
    const message = data.choices?.[0]?.message;
    const content = message?.content;
    if (typeof content === 'string') {
        const text = content.trim();
        if (text) {
            return text;
        }
    }
    if (Array.isArray(content)) {
        const text = content
            .filter((part) => part.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text.trim())
            .filter(Boolean)
            .join('\n');
        if (text) {
            return text;
        }
    }
    const reasoning = [message?.reasoning, message?.reasoning_content].find((value) => typeof value === 'string' && value.trim().length > 0);
    if (reasoning) {
        return reasoning.trim();
    }
    return '';
}
export function withTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`;
}
export function safeParseJson(text) {
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
export function truncate(text, max) {
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, max)}…`;
}
export function wrapFetchError(error, timeoutMs, label = '视觉模型') {
    if (error instanceof Error) {
        if (error.name === 'AbortError') {
            return new Error(`上游${label}请求超时 (${timeoutMs}ms)`);
        }
        if (error instanceof TypeError) {
            return new Error(`无法连接到上游${label} API: ${error.message}`);
        }
        return error;
    }
    return new Error(String(error));
}
