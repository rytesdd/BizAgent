/**
 * AI 控制器 - 处理所有 AI 相关的路由逻辑
 * 
 * 包括：
 * - /api/ai/chat - 通用 AI 聊天接口
 * - /api/vendor/handle-comment - 处理评论（支持真人和 AI 回复）
 * - /api/vendor/auto-reply - 自动触发乙方 AI 回复
 * - /api/vendor/auto-reply-stream - 自动触发乙方 AI 回复（SSE 流式 + 思维链）
 * - /api/vendor/reply - 手动触发乙方 AI 回复
 * - /api/vendor/human-reply - 乙方真人回复
 */

const db = require("../utils/db");
const aiService = require("../../services/aiService");

// ============================================
// 日志工具
// ============================================

function logStep(message, meta) {
    const timestamp = new Date().toISOString();
    if (meta) {
        console.log(`[${timestamp}] [AiController] ${message}`, meta);
        return;
    }
    console.log(`[${timestamp}] [AiController] ${message}`);
}

// ============================================
// 控制器方法
// ============================================

/**
 * 通用 AI 聊天接口
 * POST /api/ai/chat
 */
async function chat(req, res) {
    try {
        const { messages } = req.body || {};

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: "messages 参数无效：需要一个非空的消息数组"
            });
        }

        logStep("收到聊天请求", { messageCount: messages.length });

        // 调用 aiService.callAI (底层会根据当前配置选择 mock/ollama/kimi)
        const content = await aiService.callAI(messages, {
            temperature: 0.3,
            max_tokens: 4096,
        });

        logStep("AI 回复成功", { contentLength: content?.length });

        res.json({
            success: true,
            data: { content }
        });
    } catch (error) {
        logStep("调用失败", { error: String(error) });
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
}

/**
 * 处理评论（支持真人和 AI 回复）
 * POST /api/vendor/handle-comment
 */
async function handleComment(req, res) {
    try {
        const { comment_content: commentContent, author, trigger_ai_reply: triggerAiReply } = req.body || {};
        if (!commentContent) {
            return res.status(400).json({ success: false, error: "comment_content 不能为空" });
        }

        const { AUTHOR_TYPES, DEFAULT_VENDOR_AI_CONFIG } = db.constants;
        const normalizedAuthor = author || AUTHOR_TYPES.HUMAN_CLIENT;

        // 使用原子性操作创建评论
        const result = await db.runExclusive((data) => {
            const comment = {
                id: db.generateId("comment"),
                author_type: normalizedAuthor,
                content: String(commentContent),
                target_user_id: "",
                reply_content: "",
                reply_author_type: null,
                created_at: new Date().toISOString(),
            };

            data.comments.push(comment);
            logStep("写入评论", { author: normalizedAuthor, id: comment.id });

            return { db: data, comment };
        });

        const { comment } = result;
        const data = db.read();

        // 判断是否需要触发乙方 AI 回复
        const shouldTriggerAiReply = triggerAiReply !== false && db.canVendorAiReply(comment);

        if (shouldTriggerAiReply) {
            const persona = data.personas?.vendor || db.constants.DEFAULT_DB.personas.vendor;
            const prdText = data.project_context?.prd_text || "";
            const aiConfig = data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

            // 使用 AI 服务层
            const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

            // 原子性更新回复
            await db.runExclusive((updatedData) => {
                const target = updatedData.comments.find((item) => item.id === comment.id);
                if (target) {
                    target.reply_content = replyText.trim();
                    target.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
                    logStep("写入乙方 AI 回复", { id: comment.id });
                }
                return updatedData;
            });

            // 返回包含回复的完整评论
            return res.json({
                success: true,
                data: {
                    ...comment,
                    reply_content: replyText.trim(),
                    reply_author_type: AUTHOR_TYPES.AI_VENDOR,
                }
            });
        }

        res.json({ success: true, data: comment });
    } catch (error) {
        logStep("Handle Comment 失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 乙方真人回复指定评论
 * POST /api/vendor/human-reply
 */
async function humanReply(req, res) {
    try {
        const { comment_id: commentId, reply_content: replyContent } = req.body || {};

        if (!commentId) {
            return res.status(400).json({ success: false, error: "comment_id 不能为空" });
        }
        if (!replyContent || !replyContent.trim()) {
            return res.status(400).json({ success: false, error: "reply_content 不能为空" });
        }

        const { AUTHOR_TYPES } = db.constants;

        // 原子性操作
        const result = await db.runExclusive((data) => {
            const comment = data.comments.find((c) => c.id === commentId);

            if (!comment) {
                return { error: "评论不存在", status: 404 };
            }

            // 检查是否已有回复
            if (comment.reply_content) {
                return { error: "该评论已有回复", status: 400 };
            }

            // 写入真人回复
            comment.reply_content = replyContent.trim();
            comment.reply_author_type = AUTHOR_TYPES.HUMAN_VENDOR;
            comment.reply_created_at = new Date().toISOString();

            logStep("乙方真人回复", { commentId, replyLength: replyContent.length });

            return { db: data, comment };
        });

        if (result.error) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result.comment });
    } catch (error) {
        logStep("乙方真人回复失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 手动触发乙方 AI 回复指定评论
 * POST /api/vendor/reply
 */
async function vendorReply(req, res) {
    try {
        const { comment_id: commentId, force } = req.body || {};
        if (!commentId) {
            return res.status(400).json({ success: false, error: "comment_id 不能为空" });
        }

        const { AUTHOR_TYPES, DEFAULT_VENDOR_AI_CONFIG, DEFAULT_DB } = db.constants;
        const data = db.read();
        const comment = data.comments.find((c) => c.id === commentId);

        if (!comment) {
            return res.status(404).json({ success: false, error: "评论不存在" });
        }

        // 检查是否已有回复
        if (comment.reply_content && !force) {
            return res.status(400).json({ success: false, error: "该评论已有回复，使用 force=true 强制覆盖" });
        }

        // 检查回复规则（force 可以绕过规则）
        if (!force && !db.canVendorAiReply(comment)) {
            return res.status(403).json({
                success: false,
                error: `当前规则不允许回复 ${comment.author_type} 类型的评论`,
                hint: "可以设置 force=true 强制回复，或等待后续开放此能力",
            });
        }

        const persona = data.personas?.vendor || DEFAULT_DB.personas.vendor;
        const prdText = data.project_context?.prd_text || "";
        const aiConfig = data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

        const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

        // 原子性更新
        await db.runExclusive((updatedData) => {
            const target = updatedData.comments.find((c) => c.id === commentId);
            if (target) {
                target.reply_content = replyText.trim();
                target.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
            }
            return updatedData;
        });

        logStep("手动触发乙方 AI 回复", { commentId, forcedAiReply: !!force });

        res.json({
            success: true,
            data: {
                ...comment,
                reply_content: replyText.trim(),
                reply_author_type: AUTHOR_TYPES.AI_VENDOR,
            }
        });
    } catch (error) {
        logStep("Vendor Reply 失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 自动触发乙方 AI 回复（仅限甲方真人评论）
 * POST /api/vendor/auto-reply
 */
async function autoReply(req, res) {
    try {
        const { comment_id: commentId } = req.body || {};
        if (!commentId) {
            return res.status(400).json({ success: false, error: "comment_id 不能为空" });
        }

        const { AUTHOR_TYPES, DEFAULT_VENDOR_AI_CONFIG, DEFAULT_DB } = db.constants;
        const data = db.read();
        const comment = data.comments.find((c) => c.id === commentId);

        if (!comment) {
            return res.status(404).json({ success: false, error: "评论不存在" });
        }

        // 检查是否已有回复
        if (comment.reply_content) {
            return res.status(400).json({ success: false, error: "该评论已有回复" });
        }

        // 关键：仅允许回复甲方真人评论，防止 AI 互怼无限循环
        if (comment.author_type !== AUTHOR_TYPES.HUMAN_CLIENT) {
            logStep("自动回复跳过", { commentId, author_type: comment.author_type, reason: "非甲方真人评论" });
            return res.status(400).json({
                success: false,
                error: "自动回复仅针对甲方真人评论",
                skipped: true,
            });
        }

        const persona = data.personas?.vendor || DEFAULT_DB.personas.vendor;
        const prdText = data.project_context?.prd_text || "";
        const aiConfig = data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

        logStep("触发自动回复", { commentId, author_type: comment.author_type });

        const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

        // 原子性更新
        const updatedComment = await db.runExclusive((updatedData) => {
            const target = updatedData.comments.find((c) => c.id === commentId);
            if (target) {
                target.reply_content = replyText.trim();
                target.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
                target.reply_created_at = new Date().toISOString();
                logStep("自动回复完成", { commentId, replyLength: replyText.length });
                return { db: updatedData, comment: target };
            }
            return { db: updatedData, comment: null };
        });

        res.json({ success: true, data: updatedComment.comment || comment });
    } catch (error) {
        logStep("自动回复失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 自动触发乙方 AI 回复（SSE 流式 + 思维链）
 * POST /api/vendor/auto-reply-stream
 */
async function autoReplyStream(req, res) {
    // SSE 头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendEvent = (data) => {
        res.write("data: " + JSON.stringify(data) + "\n\n");
    };

    try {
        const { comment_id: commentId } = req.body || {};
        if (!commentId) {
            sendEvent({ type: "error", error: "comment_id 不能为空" });
            return res.end();
        }

        const { AUTHOR_TYPES, DEFAULT_VENDOR_AI_CONFIG, DEFAULT_DB } = db.constants;
        const data = db.read();
        const comment = data.comments.find((c) => c.id === commentId);

        if (!comment) {
            sendEvent({ type: "error", error: "评论不存在" });
            return res.end();
        }

        if (comment.reply_content) {
            sendEvent({ type: "error", error: "该评论已有回复" });
            return res.end();
        }

        if (comment.author_type !== AUTHOR_TYPES.HUMAN_CLIENT) {
            sendEvent({ type: "error", error: "自动回复仅针对甲方真人评论", skipped: true });
            return res.end();
        }

        const prdText = data.project_context?.prd_text || "";
        const persona = data.personas?.vendor || DEFAULT_DB.personas.vendor;
        const aiConfig = data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

        // 思维链步骤 1: 分析评论
        sendEvent({
            type: "thinking",
            step: "analyze",
            title: "分析评论内容",
            content: comment.content,
        });

        // 稍作延迟以显示步骤
        await new Promise((r) => setTimeout(r, 300));

        // 思维链步骤 2: 读取 PRD 上下文
        const prdSnippet = prdText.slice(0, 200) + (prdText.length > 200 ? "..." : "");
        sendEvent({
            type: "thinking",
            step: "context",
            title: "读取 PRD 上下文",
            content: prdSnippet || "(无 PRD 内容)",
        });

        await new Promise((r) => setTimeout(r, 300));

        // 思维链步骤 3: 开始生成
        sendEvent({ type: "generating" });

        logStep("触发自动回复（SSE）", { commentId, author_type: comment.author_type });

        const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

        // 原子性更新
        await db.runExclusive((updatedData) => {
            const target = updatedData.comments.find((c) => c.id === commentId);
            if (target) {
                target.reply_content = replyText.trim();
                target.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
                target.reply_created_at = new Date().toISOString();
                logStep("自动回复完成（SSE）", { commentId, replyLength: replyText.length });
            }
            return updatedData;
        });

        // 思维链步骤 4: 完成
        sendEvent({
            type: "done",
            reply: replyText.trim(),
        });
    } catch (error) {
        logStep("自动回复失败（SSE）", { error: String(error) });
        sendEvent({ type: "error", error: error.message || String(error) });
    }

    res.end();
}

// ============================================
// 导出
// ============================================

module.exports = {
    chat,
    handleComment,
    humanReply,
    vendorReply,
    autoReply,
    autoReplyStream,
};
