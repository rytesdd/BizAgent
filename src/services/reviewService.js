/**
 * reviewService.js - 甲方 AI 审查服务（SSE 流式）
 * 
 * 调用后端 /api/client/review-stream 端点，返回流式响应
 * 用于实时显示 Chain-of-Thought 思维过程
 */

/**
 * 流式审查文档
 * 
 * @param {Object} options - 审查选项
 * @param {string} options.prdText - PRD 文档内容
 * @param {File} options.prdFile - PRD 文件（可选，与 prdText 二选一）
 * @param {Function} options.onDelta - 每个 delta chunk 的回调
 * @param {Function} options.onThinking - 思考内容更新回调
 * @param {Function} options.onComplete - 流完成回调，返回 { comments, fullContent }
 * @param {Function} options.onError - 错误回调
 * @param {AbortSignal} options.signal - 可选的 AbortSignal 用于取消请求
 * @returns {Promise<void>}
 */
export async function reviewDocumentStream({
    prdText,
    prdFile,
    onDelta,
    onThinking,
    onComplete,
    onError,
    signal,
}) {
    try {
        let body;
        let headers = {};

        // 如果提供了文件，使用 FormData
        if (prdFile) {
            body = new FormData();
            body.append('prd_file', prdFile);
        } else {
            // 否则使用 JSON
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ prd_text: prdText || '' });
        }

        const response = await fetch('/api/client/review-stream', {
            method: 'POST',
            headers,
            body,
            signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 获取 ReadableStream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // 状态机变量
        let buffer = '';
        let thinkingContent = '';
        let isInsideThinking = false;
        let jsonBuffer = '';

        // 流解析循环
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                console.log('[ReviewService] Stream ended');
                break;
            }

            // 解码 chunk 并添加到缓冲区
            buffer += decoder.decode(value, { stream: true });

            // 处理 SSE 事件（按行分割）
            const lines = buffer.split('\n');
            // 保留最后一个不完整的行
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                try {
                    const jsonStr = line.slice(6); // 移除 "data: " 前缀
                    if (!jsonStr.trim()) continue;

                    const event = JSON.parse(jsonStr);

                    if (event.type === 'delta') {
                        const content = event.content;

                        // 调用原始 delta 回调
                        onDelta?.(content);

                        // 使用状态机解析 <thinking> 标签
                        let remaining = content;

                        while (remaining.length > 0) {
                            if (isInsideThinking) {
                                const endIdx = remaining.indexOf('</thinking>');
                                if (endIdx === -1) {
                                    // 标签未结束，全部算作思考内容
                                    thinkingContent += remaining;
                                    onThinking?.(thinkingContent);
                                    break;
                                } else {
                                    // 标签结束
                                    thinkingContent += remaining.slice(0, endIdx);
                                    onThinking?.(thinkingContent);
                                    remaining = remaining.slice(endIdx + 11); // 跳过 </thinking>
                                    isInsideThinking = false;
                                }
                            } else {
                                const startIdx = remaining.indexOf('<thinking>');
                                if (startIdx === -1) {
                                    // 非思考内容，添加到 JSON 缓冲区
                                    jsonBuffer += remaining;
                                    break;
                                } else {
                                    // 思考标签开始
                                    jsonBuffer += remaining.slice(0, startIdx);
                                    remaining = remaining.slice(startIdx + 10); // 跳过 <thinking>
                                    isInsideThinking = true;
                                }
                            }
                        }
                    } else if (event.type === 'done') {
                        console.log('[ReviewService] Stream complete', {
                            commentCount: event.comments?.length,
                            thinkingLength: thinkingContent.length,
                        });
                        onComplete?.({
                            comments: event.comments || [],
                            fullContent: event.fullContent || '',
                            thinkingContent,
                        });
                    } else if (event.type === 'error') {
                        console.error('[ReviewService] Server error:', event.error);
                        onError?.(new Error(event.error));
                    }
                } catch (parseError) {
                    console.warn('[ReviewService] Parse error:', parseError, 'Line:', line);
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[ReviewService] Request aborted');
            return;
        }
        console.error('[ReviewService] Error:', error);
        onError?.(error);
    }
}

/**
 * 创建一个可取消的审查请求
 * @returns {{ abort: Function, promise: Promise }}
 */
export function createCancelableReview(options) {
    const controller = new AbortController();

    return {
        abort: () => controller.abort(),
        promise: reviewDocumentStream({
            ...options,
            signal: controller.signal,
        }),
    };
}

export default {
    reviewDocumentStream,
    createCancelableReview,
};
