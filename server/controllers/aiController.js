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
const personaPrompts = require("../prompts/personaPrompts");

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

// ============================================
// ReAct Loop - 推理与行动循环 Agent
// ============================================

/** ReAct Loop 配置 */
const REACT_CONFIG = {
    MAX_TURNS: 5,           // 最大循环次数，防止无限循环
    TEMPERATURE: 0.3,       // AI 温度，较低以保持稳定性
    MAX_TOKENS: 4096,       // 最大 token 数
};

/** 可用工具列表 */
const AVAILABLE_ACTIONS = ['search_engine', 'read_doc', 'query_db', 'finish'];

/**
 * 构建连续推理上下文提示
 * @param {object} projectContext - 项目上下文
 * @param {boolean} hasHistory - 是否有历史对话
 * @returns {string} 连续推理指令
 */
function buildContinuityPrompt(projectContext, hasHistory) {
    const baseContext = `## 当前项目状态
${JSON.stringify(projectContext, null, 2)}`;

    if (!hasHistory) {
        return baseContext;
    }

    return `${baseContext}

## 连续推理规则 (CRITICAL)
你是一个具有持续记忆的 Agent。请遵循以下规则：

1. **回顾历史思考**: 仔细阅读对话历史中的 <thinking>...</thinking> 标签内容
2. **避免重复分析**: 不要重新查询你已经获得的信息
3. **增量推理**: 如果用户在追问，直接基于之前的结论继续推进
4. **引用已知事实**: 回答时可以引用之前轮次确立的事实

示例场景：
- 之前你通过 query_db 得知 "项目进度 45%"
- 用户追问 "那预计什么时候完成？"
- ❌ 错误做法: 再次调用 query_db 查询进度
- ✅ 正确做法: 直接基于已知的 45% 进度进行推算，使用 finish 回答`;
}

/**
 * 格式化消息历史，注入思维链标签
 * 将包含 thought_content 的 assistant 消息转换为带 <thinking> 标签的格式
 * @param {Array} messages - 原始消息数组
 * @returns {Array} 格式化后的消息数组
 */
function formatMessagesWithThoughts(messages) {
    return messages.map(msg => {
        // 如果是 assistant 消息且包含思考内容
        if (msg.role === 'assistant' && msg.thought_content) {
            return {
                role: 'assistant',
                content: `<thinking>${msg.thought_content}</thinking>\n${msg.content}`
            };
        }
        // 普通消息直接返回简化版本
        return { role: msg.role, content: msg.content };
    });
}

/**
 * 检测用户消息是否为追问/后续问题
 * @param {Array} messages - 消息历史
 * @returns {boolean}
 */
function isFollowUpQuestion(messages) {
    if (messages.length < 3) return false; // 至少需要：user -> assistant -> user

    const recentUserMessages = messages
        .filter(m => m.role === 'user')
        .slice(-2);

    if (recentUserMessages.length < 2) return false;

    // 简单检测：短问题或包含追问关键词
    const lastMsg = recentUserMessages[1]?.content || "";
    const followUpPatterns = [
        /^(那|然后|接着|所以|因此|那么)/,
        /^(怎么|如何|为什么|什么时候)/,
        /^.{1,20}[?？]$/,  // 短问题
        /(继续|详细|具体|展开|解释)/,
    ];

    return followUpPatterns.some(pattern => pattern.test(lastMsg));
}

/**
 * Agent 系统提示词 - 定义 ReAct 协议（含连续推理）
 * @param {object} projectContext - 项目上下文摘要
 * @param {boolean} hasHistory - 是否有对话历史
 * @returns {string} 系统提示词
 */
function buildAgentSystemPrompt(projectContext, hasHistory = false) {
    return `你是 BizAgent，一个强大的 AI 协作助手。你必须使用 ReAct (Reasoning + Acting) 模式来回答用户问题。

## 核心协议
你必须 **始终** 以严格的 JSON 格式响应，不要有任何其他文字或 Markdown 格式：

{
  "thought": "你的思考过程（中文）",
  "action": "工具名称",
  "args": { ... }
}

## 可用工具 (Actions)

1. **search_engine** - 搜索外部信息（天气、新闻、百科等）
   - args: { "query": "搜索关键词" }
   - 适用场景：用户询问与当前项目无关的外部信息

2. **read_doc** - 读取并分析 PRD 文档
   - args: { "query": "关注的内容或问题" }
   - 适用场景：用户询问项目需求、文档内容

3. **query_db** - 查询项目元数据
   - args: { "query": "查询的信息类型" }
   - 适用场景：用户询问项目进度、甲方/乙方信息、评论统计

4. **finish** - 完成任务，返回最终答案
   - args: { "content": "给用户的最终答案（Markdown 格式）" }
   - ⚠️ 当你有足够信息回答用户时，必须使用此 action 结束对话

${buildContinuityPrompt(projectContext, hasHistory)}

## 工作流程示例

用户问: "项目进度如何？甲方是谁？"

第一轮你应该返回:
{
  "thought": "用户询问项目进度和甲方信息，我需要查询数据库获取这些元数据。",
  "action": "query_db",
  "args": { "query": "项目进度和甲方信息" }
}

收到工具结果后，第二轮你应该返回:
{
  "thought": "我已经获得了项目信息：进度 45%，甲方是张总(CTO)。现在可以回答用户了。",
  "action": "finish",
  "args": { "content": "## 项目状态\\n\\n- **进度**: 开发阶段 (45%)\\n- **甲方负责人**: 张总 (CTO)\\n\\n项目正在顺利推进中！" }
}

## 重要规则
1. 每次响应必须是合法的 JSON，不要包含 \`\`\`json 代码块
2. 如果是简单闲聊或打招呼，直接使用 finish 返回友好回复
3. 如果需要多个工具，每次只调用一个，根据结果决定下一步
4. 最多进行 ${REACT_CONFIG.MAX_TURNS} 轮工具调用，之后必须 finish
5. 所有回答内容使用中文
6. **阅读历史 <thinking> 标签**：如果对话历史中有之前的思考过程，优先复用已知信息`;
}

/**
 * 解析 AI 响应为 JSON
 * @param {string} response - AI 原始响应
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function parseAgentResponse(response) {
    try {
        // 清理可能的 Markdown 代码块
        let cleaned = response.replace(/```json\s*|```\s*/g, "").trim();

        // 尝试提取 JSON 对象（处理多余文字）
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        const parsed = JSON.parse(cleaned);

        // 验证必需字段
        if (!parsed.thought || !parsed.action || !parsed.args) {
            return {
                success: false,
                error: "JSON 缺少必需字段: thought, action, args"
            };
        }

        // 验证 action 是否在允许列表中
        if (!AVAILABLE_ACTIONS.includes(parsed.action)) {
            return {
                success: false,
                error: `未知的 action: "${parsed.action}"，可用: ${AVAILABLE_ACTIONS.join(", ")}`
            };
        }

        return { success: true, data: parsed };
    } catch (e) {
        return {
            success: false,
            error: `JSON 解析失败: ${e.message}`
        };
    }
}

/**
 * 执行搜索引擎工具 (Mock 实现)
 * @param {object} args - 工具参数
 * @param {object} dbData - 数据库数据
 * @returns {{ success: boolean, result: string }}
 */
function executeSearchEngine(args, dbData) {
    const query = args.query || "通用搜索";

    // TODO: 后续接入 SerpApi / Tavily / DuckDuckGo
    const mockResults = [
        { title: "天气预报", snippet: "今天天气晴朗，温度 22°C，适合户外活动。" },
        { title: "热点新闻", snippet: "科技领域：AI Agent 技术持续火热，企业智能化升级加速。" },
        { title: "百科知识", snippet: "根据公开资料，该领域正在经历快速发展阶段。" },
    ];

    logStep("Tool: search_engine", { query });

    const result = `[搜索结果] 针对 "${query}" 的查询：
${mockResults.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join("\n")}

注: 以上为模拟搜索结果。`;

    return { success: true, result };
}

/**
 * 执行文档读取工具
 * @param {object} args - 工具参数
 * @param {object} dbData - 数据库数据
 * @returns {{ success: boolean, result: string }}
 */
function executeReadDoc(args, dbData) {
    const prdText = dbData.project_context?.prd_text || "";
    const query = args.query || "全文";
    const MAX_CHARS = 10000;

    if (!prdText || prdText.trim() === "") {
        logStep("Tool: read_doc - 无文档");
        return {
            success: true,
            result: "[文档状态] 当前未加载任何 PRD 文档。请先上传文档后再进行分析。"
        };
    }

    let docContent = prdText;
    if (prdText.length > MAX_CHARS) {
        logStep("Tool: read_doc - 截断", { original: prdText.length, truncated: MAX_CHARS });
        docContent = prdText.slice(0, MAX_CHARS) + `\n\n... [文档已截断，共 ${prdText.length} 字符] ...`;
    } else {
        logStep("Tool: read_doc", { length: prdText.length, query });
    }

    return {
        success: true,
        result: `=== PRD 文档 (查询: ${query}) ===\n${docContent}\n=== 文档结束 ===`
    };
}

/**
 * 执行数据库查询工具
 * @param {object} args - 工具参数
 * @param {object} dbData - 数据库数据
 * @returns {{ success: boolean, result: string }}
 */
function executeQueryDb(args, dbData) {
    const query = args.query || "全部信息";

    const projectInfo = {
        project_meta: dbData.project_meta || {
            project_name: "未命名项目",
            version: "N/A",
            progress: "未知",
            current_stage: "未知",
        },
        stakeholders: {
            client_persona: dbData.personas?.client || "未设置",
            vendor_persona: dbData.personas?.vendor || "未设置",
            client_contact: dbData.project_meta?.stakeholders?.client || "未设置",
            vendor_contact: dbData.project_meta?.stakeholders?.vendor || "未设置",
        },
        document_status: {
            has_prd: !!dbData.project_context?.prd_text,
            prd_file: dbData.project_context?.prd_file_path || "无",
            prd_length: dbData.project_context?.prd_text?.length || 0,
        },
        comments_summary: {
            total: dbData.comments?.length || 0,
            with_replies: dbData.comments?.filter(c => c.reply_content)?.length || 0,
        },
        sessions_summary: {
            client_sessions: dbData.client_chat_sessions?.length || 0,
            vendor_sessions: dbData.vendor_chat_sessions?.length || 0,
        },
    };

    logStep("Tool: query_db", { query, projectName: projectInfo.project_meta.project_name });

    return {
        success: true,
        result: `[项目数据库查询结果] 查询: ${query}\n${JSON.stringify(projectInfo, null, 2)}`
    };
}

/**
 * 执行工具动作
 * @param {string} action - 工具名称
 * @param {object} args - 工具参数
 * @param {object} dbData - 数据库数据
 * @returns {{ success: boolean, result: string, error?: string }}
 */
function executeToolAction(action, args, dbData) {
    try {
        switch (action) {
            case "search_engine":
                return executeSearchEngine(args, dbData);
            case "read_doc":
                return executeReadDoc(args, dbData);
            case "query_db":
                return executeQueryDb(args, dbData);
            default:
                return { success: false, result: "", error: `未知工具: ${action}` };
        }
    } catch (error) {
        logStep("Tool 执行异常", { action, error: String(error) });
        return { success: false, result: "", error: `工具执行失败: ${error.message}` };
    }
}

/**
 * ReAct Loop 核心执行器 (含思维链连续性)
 * @param {Array} userMessages - 用户消息历史
 * @param {object} dbData - 数据库数据
 * @returns {Promise<{ content: string, trace: Array, thought_content: string }>}
 */
async function runReActLoop(userMessages, dbData) {
    // 构建项目上下文
    const projectContext = {
        prd_status: dbData.project_context?.prd_text ? "已加载PRD文档" : "未加载文档",
        project_name: dbData.project_meta?.project_name || "未命名项目",
        progress: dbData.project_meta?.progress || "未知",
        current_stage: dbData.project_meta?.current_stage || "未知",
        current_time: new Date().toLocaleString("zh-CN"),
    };

    // 检测是否有历史对话（用于连续推理）
    const hasHistory = userMessages.length > 1;
    const isFollowUp = isFollowUpQuestion(userMessages);

    logStep("上下文分析", { hasHistory, isFollowUp, messageCount: userMessages.length });

    // 格式化消息历史，注入 <thinking> 标签
    const formattedMessages = formatMessagesWithThoughts(userMessages);

    // 初始化消息（使用增强的系统提示）
    const agentMessages = [
        { role: "system", content: buildAgentSystemPrompt(projectContext, hasHistory) },
        ...formattedMessages
    ];

    // 思维链追踪
    const trace = [];
    const allThoughts = []; // 收集所有思考过程
    let turnCount = 0;

    logStep("ReAct Loop 开始", { maxTurns: REACT_CONFIG.MAX_TURNS, hasHistory });

    // ReAct 主循环
    while (turnCount < REACT_CONFIG.MAX_TURNS) {
        turnCount++;
        logStep(`ReAct Turn ${turnCount}/${REACT_CONFIG.MAX_TURNS}`);

        // 1. 调用 AI
        let aiResponse;
        try {
            aiResponse = await aiService.callAI(agentMessages, {
                temperature: REACT_CONFIG.TEMPERATURE,
                max_tokens: REACT_CONFIG.MAX_TOKENS,
            });
        } catch (error) {
            logStep("AI 调用失败", { error: String(error) });
            return {
                content: "抱歉，AI 服务暂时不可用，请稍后重试。",
                trace: [...trace, { turn: turnCount, error: "AI service unavailable" }],
                thought_content: allThoughts.join("\n")
            };
        }

        logStep("AI 响应", { responseLength: aiResponse?.length, preview: aiResponse?.slice(0, 100) });

        // 2. 解析 JSON
        const parseResult = parseAgentResponse(aiResponse);

        if (!parseResult.success) {
            // 解析失败 - 自我纠正机制
            logStep("JSON 解析失败，触发自我纠正", { error: parseResult.error });

            trace.push({
                turn: turnCount,
                raw_response: aiResponse?.slice(0, 200),
                error: parseResult.error,
                recovery: "self_correction"
            });

            agentMessages.push({ role: "assistant", content: aiResponse });
            agentMessages.push({
                role: "user",
                content: `[系统错误] 你的响应不是有效的 JSON: ${parseResult.error}\n\n请重新生成一个严格符合格式的 JSON 响应。记住不要包含任何 Markdown 代码块或额外文字。`
            });

            continue;
        }

        const { thought, action, args } = parseResult.data;
        logStep("Agent 决策", { thought: thought.slice(0, 50), action, args });

        // 收集思考过程
        allThoughts.push(`[Turn ${turnCount}] ${thought}`);

        // 记录思维链
        trace.push({
            turn: turnCount,
            thought,
            action,
            args,
        });

        // 3. 检查是否完成
        if (action === "finish") {
            const finalContent = args.content || "任务已完成。";
            logStep("ReAct Loop 完成", { turns: turnCount });
            return {
                content: finalContent,
                trace,
                thought_content: allThoughts.join("\n") // 聚合所有思考过程
            };
        }

        // 4. 执行工具
        const toolResult = executeToolAction(action, args, dbData);

        if (!toolResult.success) {
            logStep("工具执行失败", { action, error: toolResult.error });

            trace[trace.length - 1].tool_error = toolResult.error;
            allThoughts.push(`[Turn ${turnCount}] 工具错误: ${toolResult.error}`);

            agentMessages.push({ role: "assistant", content: aiResponse });
            agentMessages.push({
                role: "user",
                content: `[工具错误] ${action} 执行失败: ${toolResult.error}\n\n请尝试其他方法或直接使用 finish 返回你已知的信息。`
            });

            continue;
        }

        // 5. 将工具结果追加到消息
        const resultPreview = toolResult.result.slice(0, 200) + (toolResult.result.length > 200 ? "..." : "");
        trace[trace.length - 1].tool_result = resultPreview;
        allThoughts.push(`[Turn ${turnCount}] 工具 ${action} 返回: ${resultPreview}`);

        agentMessages.push({ role: "assistant", content: aiResponse });
        agentMessages.push({
            role: "user",
            content: `[工具结果] ${action} 返回:\n${toolResult.result}\n\n请基于以上信息继续推理。如果已经可以回答用户，请使用 finish action。`
        });

        logStep("工具结果已追加", { action, resultLength: toolResult.result.length });
    }

    // 超过最大轮次 - 强制完成
    logStep("ReAct Loop 超时，强制结束", { turns: turnCount });

    return {
        content: "抱歉，我在处理您的请求时遇到了一些困难。请尝试简化您的问题，或分步骤提问。",
        trace: [...trace, { turn: turnCount + 1, forced_finish: true }],
        thought_content: allThoughts.join("\n")
    };
}

/**
 * 智能对话控制器 - ReAct Loop Agent
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

        const lastMessage = messages[messages.length - 1]?.content || "";
        logStep("收到聊天请求 (ReAct)", {
            messageCount: messages.length,
            lastMessage: lastMessage.slice(0, 50)
        });

        // 获取数据库数据
        const dbData = db.read();

        // 运行 ReAct Loop (含思维链连续性)
        const { content, trace, thought_content } = await runReActLoop(messages, dbData);

        logStep("ReAct 响应完成", {
            contentLength: content?.length,
            totalTurns: trace.length,
            hasThoughts: !!thought_content
        });

        res.json({
            success: true,
            data: {
                content,
                // 思考过程内容 - 前端可保存到 session 消息中用于连续推理
                thought_content: thought_content || null,
                _debug: {
                    mode: "react_loop_with_continuity",
                    total_turns: trace.length,
                    trace: trace,
                }
            }
        });

    } catch (error) {
        logStep("Chat ReAct 失败", { error: String(error) });
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

/**
 * 智能人设对话 - 双面人设 (Narrative Engine + Widgets)
 * POST /api/ai/persona-chat
 */
async function personaChat(req, res) {
    try {
        const { messages, persona, persona_config, intent } = req.body || {};

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: "messages 参数无效"
            });
        }

        const validPersonas = Object.values(personaPrompts.PERSONA_TYPES);
        const targetPersona = validPersonas.includes(persona) ? persona : personaPrompts.PERSONA_TYPES.VENDOR;

        // 获取项目上下文
        const dbData = db.read();
        const projectContext = {
            project_name: dbData.project_meta?.project_name,
            current_stage: dbData.project_meta?.current_stage,
            progress: dbData.project_meta?.progress,
            has_prd: !!dbData.project_context?.prd_text,
        };

        // 构建系统提示词 (含自定义配置)
        const systemPrompt = personaPrompts.buildPersonaSystemPrompt(
            targetPersona,
            projectContext,
            persona_config,
            intent
        );

        // 构造消息列表
        const chatMessages = [
            { role: "system", content: systemPrompt },
            ...messages
        ];

        logStep(`Persona Chat [${targetPersona}]`, {
            messageCount: messages.length,
            hasConfig: !!persona_config
        });

        // 调用 AI
        const aiResponse = await aiService.callAI(chatMessages, {
            temperature: 0.7, // 稍微高一点的温度以增加叙事丰富性
            max_tokens: 4096,
        });

        // 解析 Widget 响应
        const parseResult = personaPrompts.parseWidgetResponse(aiResponse, targetPersona, intent);

        if (!parseResult.success) {
            logStep("Persona Chat 解析失败 - 降级为文本", { error: parseResult.error });
            // 如果解析失败，尝试作为纯文本 Markdown 返回
            return res.json({
                success: true,
                data: {
                    widgets: [
                        { type: 'markdown', content: aiResponse }
                    ],
                    _debug: { raw: aiResponse, error: parseResult.error }
                }
            });
        }

        res.json({
            success: true,
            data: {
                widgets: parseResult.widgets,
                _debug: { raw: aiResponse }
            }
        });

    } catch (error) {
        logStep("Persona Chat 失败", { error: String(error) });
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
}

// ============================================
// 直通 AI 聊天 - 不经过 ReAct Loop，直接转发 messages 给 AI
// 用于前端需要精确控制 system prompt 的场景（如 JSON 结构化输出）
// ============================================

/**
 * 直通 AI 聊天控制器
 * POST /api/ai/simple-chat
 * 
 * 与 /api/ai/chat 的区别：
 * - /api/ai/chat 会注入 ReAct Agent 系统提示词，走工具调用循环
 * - /api/ai/simple-chat 直接转发 messages 给 AI，前端完全控制 prompt
 * 
 * 适用场景：评论总结、Patch 生成等需要 JSON 结构化输出的功能
 */
async function simpleChat(req, res) {
    try {
        const { messages } = req.body || {};

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: "messages 参数无效：需要一个非空的消息数组"
            });
        }

        const lastMessage = messages[messages.length - 1]?.content || "";
        logStep("收到直通聊天请求 (Simple)", {
            messageCount: messages.length,
            lastMessage: lastMessage.slice(0, 50)
        });

        // 直接调用 AI，不经过 ReAct Loop
        const content = await aiService.callAI(messages, {
            temperature: 0.3,
            max_tokens: 4096,
        });

        logStep("直通聊天响应完成", { contentLength: content?.length });

        res.json({
            success: true,
            data: {
                content,
            }
        });

    } catch (error) {
        logStep("Simple Chat 失败", { error: String(error) });
        res.status(500).json({
            success: false,
            error: error.message || String(error)
        });
    }
}

// ============================================
// 导出
// ============================================

module.exports = {
    chat,
    simpleChat,
    handleComment,
    humanReply,
    vendorReply,
    autoReply,
    autoReplyStream,
    personaChat,
};
