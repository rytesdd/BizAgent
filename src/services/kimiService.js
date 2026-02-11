/**
 * Kimi Service - Proxy through backend to avoid exposing API key in frontend
 * 
 * This service calls the backend /api/ai/chat endpoint which handles
 * the actual Kimi API communication securely.
 */

/**
 * Sends a message to the Kimi API via backend proxy.
 * @param {Array<{role: string, content: string}>} messages - Array of message objects
 * @returns {Promise<string>} - The content of the response message
 */
export async function sendMessageToKimi(messages) {
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                // Request JSON mode for structured output
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Backend AI API Error:", response.status, response.statusText, errorData);
            throw new Error(errorData.error || `API Request Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Backend returns { success: true, data: { content: "..." } }
        if (data.success && data.data?.content) {
            return data.data.content;
        }

        // Fallback: If backend returns raw content
        if (data.content) {
            return data.content;
        }

        // If response format is unexpected
        console.warn("Unexpected response format:", data);
        return JSON.stringify(data);

    } catch (error) {
        console.error("Error calling AI API:", error);
        throw error;
    }
}

/**
 * 从混合文本中提取 JSON 对象/数组。
 * AI 经常在 JSON 前后加自然语言解释，这个工具函数从中提取出有效 JSON。
 * @param {string} text - AI 返回的原始文本
 * @returns {object|null} - 解析后的 JSON 对象，或 null
 */
export function extractJsonFromText(text) {
    if (!text) return null;

    // 1. 先尝试直接解析
    try {
        return JSON.parse(text.trim());
    } catch (e) {
        // 继续尝试其他方式
    }

    // 2. 去掉 markdown 代码块包裹
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            // 继续
        }
    }

    // 3. 用正则提取第一个 {...} 或 [...] 结构
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(text.substring(firstBrace, lastBrace + 1));
        } catch (e) {
            // 继续
        }
    }

    // 4. 尝试 [...] 数组格式
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        try {
            return JSON.parse(text.substring(firstBracket, lastBracket + 1));
        } catch (e) {
            // 继续
        }
    }

    return null;
}

/**
 * 直通 AI 聊天 - 不经过 ReAct Agent 循环，直接转发 messages 给 AI。
 * 适用于需要前端完全控制 system prompt 的场景，如 JSON 结构化输出。
 * 
 * @param {Array<{role: string, content: string}>} messages - 消息数组
 * @returns {Promise<string>} - AI 返回的原始文本
 */
export async function sendSimpleChat(messages) {
    try {
        const response = await fetch('/api/ai/simple-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Backend Simple Chat API Error:", response.status, response.statusText, errorData);
            throw new Error(errorData.error || `API Request Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.data?.content) {
            return data.data.content;
        }

        if (data.content) {
            return data.content;
        }

        console.warn("Unexpected response format:", data);
        return JSON.stringify(data);

    } catch (error) {
        console.error("Error calling Simple Chat API:", error);
        throw error;
    }
}

/**
 * Runs a connection test to verify integration.
 * Prints the response to the console.
 */
export async function runConnectionTest() {
    console.log("Starting Kimi Connection Test via Backend...");
    try {
        const testMessage = [{ role: "user", content: "你好，请简短回复确认连接成功。" }];
        const response = await sendMessageToKimi(testMessage);
        console.log("Kimi Connection Test Success! Response:", response);
        return response;
    } catch (error) {
        console.error("Kimi Connection Test Failed:", error.message);
        throw error;
    }
}
/**
 * Sends a message to the Persona Chat API (Narrative Engine).
 * @param {Array} messages - Message history
 * @param {string} persona - 'vendor' | 'client'
 * @param {Object} config - { role, goal, tone }
 * @returns {Promise<Object>} - { widgets: [], ... }
 */
/**
 * 流式人设对话 - SSE 流式 + Chain-of-Thought
 * 调用后端 /api/ai/persona-chat-stream，实时返回思考过程和内容。
 *
 * @param {Object} options
 * @param {Array} options.messages - 消息历史
 * @param {string} options.persona - 'vendor' | 'client'
 * @param {Object} options.config - { role, goal, tone }
 * @param {string} options.intent - 意图
 * @param {Function} options.onDelta - 每个 delta chunk 的回调
 * @param {Function} options.onThinking - 思考内容实时更新回调 (thinkingContent: string)
 * @param {Function} options.onComplete - 流完成回调 ({ widgets, thinkingContent })
 * @param {Function} options.onError - 错误回调
 * @param {AbortSignal} options.signal - 可选的 AbortSignal
 * @returns {Promise<void>}
 */
export async function sendPersonaChatStream({
    messages,
    persona,
    config,
    intent = null,
    onDelta,
    onThinking,
    onComplete,
    onError,
    signal,
}) {
    try {
        const response = await fetch('/api/ai/persona-chat-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                persona,
                persona_config: config,
                intent,
            }),
            signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // SSE 行缓冲
        let sseBuffer = '';
        
        // 累积缓冲区：解决标签被拆分到多个 chunk 的问题
        let fullContentBuffer = '';  // 累积所有 delta 内容
        let lastReportedThinking = '';  // 上次回调的 thinking 内容
        let thinkingComplete = false;  // 是否已检测到 </thinking>

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });

            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                try {
                    const jsonStr = line.slice(6);
                    if (!jsonStr.trim()) continue;

                    const event = JSON.parse(jsonStr);

                    if (event.type === 'delta') {
                        const content = event.content;
                        onDelta?.(content);

                        // 累积到完整缓冲区
                        fullContentBuffer += content;

                        // 在完整缓冲区上检测标签（解决标签被拆分的问题）
                        if (!thinkingComplete) {
                            const startTag = '<thinking>';
                            const endTag = '</thinking>';
                            
                            const startIdx = fullContentBuffer.indexOf(startTag);
                            const endIdx = fullContentBuffer.indexOf(endTag);

                            if (startIdx !== -1) {
                                // 找到了开始标签
                                if (endIdx !== -1 && endIdx > startIdx) {
                                    // 也找到了结束标签 → thinking 完成
                                    const thinkingContent = fullContentBuffer.substring(startIdx + startTag.length, endIdx);
                                    if (thinkingContent !== lastReportedThinking) {
                                        lastReportedThinking = thinkingContent;
                                        onThinking?.(thinkingContent);
                                    }
                                    thinkingComplete = true;
                                    console.log('[PersonaChatStream] Thinking complete, length:', thinkingContent.length);
                                } else {
                                    // 只有开始标签，还没有结束标签 → 提取当前内容
                                    const thinkingContent = fullContentBuffer.substring(startIdx + startTag.length);
                                    if (thinkingContent !== lastReportedThinking) {
                                        lastReportedThinking = thinkingContent;
                                        onThinking?.(thinkingContent);
                                    }
                                }
                            }
                        }
                    } else if (event.type === 'done') {
                        console.log('[PersonaChatStream] Stream complete', {
                            widgetCount: event.widgets?.length,
                            thinkingLength: lastReportedThinking.length,
                        });
                        onComplete?.({
                            widgets: event.widgets || [],
                            thinkingContent: lastReportedThinking || event.thinkingContent || '',
                        });
                    } else if (event.type === 'error') {
                        console.error('[PersonaChatStream] Server error:', event.error);
                        onError?.(new Error(event.error));
                    }
                } catch (parseError) {
                    console.warn('[PersonaChatStream] Parse error:', parseError, 'Line:', line);
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[PersonaChatStream] Request aborted');
            return;
        }
        console.error('[PersonaChatStream] Error:', error);
        onError?.(error);
    }
}

export async function sendPersonaChat(messages, persona, config, intent = null) {
    try {
        const response = await fetch('/api/ai/persona-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                persona: persona,
                persona_config: config,
                intent: intent
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Request Failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
            return data.data; // Returns { widgets: [...], _debug: ... }
        }

        throw new Error("Invalid response format");
    } catch (error) {
        console.error("Error calling Persona Chat API:", error);
        throw error;
    }
}
