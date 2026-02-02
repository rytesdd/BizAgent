/**
 * AiAssistantSidebar - AI Chat Interface using Ant Design X
 * 
 * A fixed-width sidebar for conversational AI assistance.
 * Uses @ant-design/x Bubble and Sender components.
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Bubble, Sender, ThoughtChain } from '@ant-design/x';
import { ConfigProvider, theme } from 'antd';
import { sendMessageToKimi } from '../services/kimiService';
import { DOCUMENT_CONTENT } from '../data/documentModel';

// ==========================================
// AI Avatar Component
// ==========================================
const AIAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
        AI
    </div>
);

// ==========================================
// User Avatar Component
// ==========================================
const UserAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shadow-lg">
        U
    </div>
);

// ==========================================
// Thinking Component (Real CoT)
// ==========================================
// ==========================================
// Thinking Indicator
// ==========================================
const ThinkingIndicator = () => (
    <div className="flex items-center gap-1.5 text-violet-400 text-xs">
        <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
        <span className="ml-1 opacity-70">Thinking...</span>
    </div>
);

// ==========================================
// Main Component
// ==========================================
// ==========================================
// Main Component
// ==========================================
const AiAssistantSidebar = forwardRef(({ onTriggerAiReview }, ref) => {
    // --- State ---
    const [messages, setMessages] = useState([
        {
            key: 'welcome',
            role: 'ai',
            content: '你好！我是你的 AI 助手。有什么可以帮助你的吗？'
        }
    ]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const scrollRef = useRef(null);

    // Expose triggerReview method to parent
    useImperativeHandle(ref, () => ({
        triggerReview: async () => {
            // We can trigger the auto review by calling handleSend with a special flag
            // OR directly invoking logic. Since handleSend is inside, we can just call it.
            await handleSend(null, true);
        }
    }));

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // --- Send Message Handler ---
    // --- Send Message Handler ---
    const handleSend = async (content, isAutoReview = false) => {
        // Allow empty content if it's an auto-review trigger (which sends a system prompt instruction as user message equivalent)
        if (!isAutoReview && (!content || !content.trim())) return;

        // If auto-review, simulate a user trigger message
        const displayContent = isAutoReview ? "启动虚拟代理自动审查..." : content.trim();

        const userMessage = {
            key: `user_${Date.now()}`,
            role: 'user',
            content: displayContent
        };

        setMessages(prev => [...prev, userMessage]);
        if (!isAutoReview) setInputValue('');
        setLoading(true);

        // Pre-create AI message to stream/update thought
        const aiMessageId = `ai_${Date.now()}`;
        const initialAiMessage = {
            key: aiMessageId,
            role: 'ai',
            content: '',
            thoughtContent: '',
            isThinking: true
        };
        setMessages(prev => [...prev, initialAiMessage]);

        try {
            // Extract raw text from DOCUMENT_CONTENT for the AI to read (Available for both modes)
            const documentText = DOCUMENT_CONTENT.map(b => b.text).join('\n\n');

            // Common specialized review instructions (Reused)
            const reviewInstructions = `
** 审查能力定义 **
当用户要求"审查"、"检查"、"找漏洞"或"分析"文档时，你必须变身为高级产品经理专家。
在此模式下，不要闲聊，直接分析文档并输出 strict JSON Array。

** JSON 格式要求 (必须严格遵守) **
\`\`\`json
[
  { 
    "quote": "原文中的具体句子，必须与文档内容一字不差，以便我进行高亮定位", 
    "message": "你指出的问题描述，请用专业、犀利的口吻，指出逻辑漏洞或风险" 
  }
]
\`\`\`
** 注意事项：**
1. "quote" 字段必须严格复制文档原句，**不要**自己概括，否则高亮会失败。
2. 涉及审查时，只输出 JSON 数组。`;

            let systemInstruction = "";
            let userPrompt = content ? content.trim() : "你好";

            // Special Logic for Auto Review (Button Trigger)
            if (isAutoReview) {
                systemInstruction = `你是一位在大厂工作多年的高级产品经理专家（Senior Product Reviewer）。你的任务是严格审查用户提供的 PRD 文档。

** 第一阶段：深度思考 (Thinking Process) **
首先，请在 <think> 标签内进行一步步的深度思考和推演。
- 仔细阅读文档的每一句话，寻找逻辑漏洞、含糊不清的定义（如 "待定"、"TBD"）。
- 检查规则是否存在自相矛盾的地方（例如："付费功能" 却 "消耗 0 积分"）。
- 模拟用户使用场景，推演流程是否能跑通。
- 保持批判性思维，像一位严格的面试官一样审视文档。

** 第二阶段：输出结果 (Final Output) **
思考结束后，请将发现的问题整理成一个严格的 JSON 数组格式返回。
${reviewInstructions}`;

                userPrompt = `请审查以下 PRD 文档内容：\n\n=== 文档开始 ===\n${documentText}\n=== 文档结束 ===\n\n请输出审查结果。`;
            } else {
                // NORMAL CHAT MODE (With Intent Recognition)
                systemInstruction = `你是一个专业的 AI 助手，正在帮助用户进行文档审查和项目协作。
你的知识库中已经包含了当前 PRD 文档的内容。

=== 当前 PRD 文档内容 ===
${documentText}
=== 文档结束 ===

${reviewInstructions}

** 交互策略 **
1. 如果用户只是进行日常提问或闲聊（例如"你好"、"文档里讲了什么"），请用自然语言回答，**不要**输出 JSON。
2. 如果用户明确要求进行"审查"、"挑刺"、"找问题"（例如"看看文档有什么问题"、"检查计费规则"），请立即执行审查逻辑，并**必须**输出上述 JSON 格式。`;
            }
            // Build conversation history for context
            const conversationHistory = [
                {
                    role: 'system',
                    content: systemInstruction
                },
                ...messages
                    .filter(m => m.role === 'user' || m.role === 'ai')
                    .slice(-10) // Keep last 10 messages for context
                    .map(m => ({
                        role: m.role === 'ai' ? 'assistant' : 'user',
                        // If we have thoughtContent, we might want to exclude it from context or keep it
                        // For now, let's keep simple content
                        content: m.content
                    })),
                { role: 'user', content: userPrompt }
            ];

            // Start Fake Streaming for Thinking Process
            let thoughtAccumulator = "";

            // Define two types of logs
            const AUTO_REVIEW_LOG = `正在初始化文档分析引擎...
加载 PRD 上下文数据 (12KB)... 完成
正在构建语义依赖图谱...
[Phase 1] 逻辑一致性自检
- 扫描 "计费规则" 模块... 发现潜在冲突：积分扣除规则设定为 0，这与付费属性矛盾。
- 扫描 "时间格式" ... 发现非标准定义 "TBD"，建议标准化。
[Phase 2] 用户路径模拟
- 模拟新用户注册 -> 付费转化流程...
- 正在校验边界条件：余额不足时的扣费行为...
[Phase 3] 生成审查报告
- 提取关键引用 (Quotes)...
- 格式化 JSON 输出...
- 最终校验中...`;

            const GENERAL_LOG = `正在接收用户指令...
加载上下文环境...
正在理解意图...
检索相关知识库...
构建回答逻辑...
正在组织语言...`;

            // Choose log based on mode
            const TARGET_LOG = isAutoReview ? AUTO_REVIEW_LOG : GENERAL_LOG;

            const typingInterval = setInterval(() => {
                if (thoughtAccumulator.length < TARGET_LOG.length) {
                    // Add 1-3 chars at a time for realistic typing feel
                    const nextChunk = TARGET_LOG.slice(thoughtAccumulator.length, thoughtAccumulator.length + Math.floor(Math.random() * 3) + 1);
                    thoughtAccumulator += nextChunk;

                    setMessages(prev => prev.map(msg =>
                        msg.key === aiMessageId
                            ? { ...msg, thoughtContent: thoughtAccumulator }
                            : msg
                    ));
                }
            }, 50); // Speed of typing

            const response = await sendMessageToKimi(conversationHistory);

            // API Finished: Clear typing interval
            clearInterval(typingInterval);

            const rawText = response.trim();

            console.log("[AiAssistant] Raw Response:", rawText);

            // 1. Extract Thought (Regex to find content between <think> tags)
            const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
            // If real think content exists, append it to our mock log for richness, or just replace it.
            // For better UX, let's keep our "Mock Log" as the visual "process", and maybe append the real final summary if distinct.
            // But since we want to "stop" the chain when comments appear, we just finalize it here.

            // To make it look "finished", ensure we show the user we are done thinking.
            const finalThoughtDisplay = thoughtAccumulator + "\n[系统] 分析完成，生成报告如下。";

            const thoughtProcess = thinkMatch ? thinkMatch[1].trim() : finalThoughtDisplay;

            // 2. Extract JSON (Regex to find content between ```json blocks or simple brackets)
            // Remove the thought part to isolate the 'content' part
            let mainContent = rawText.replace(/<think>[\s\S]*?<\/think>/i, "").trim();

            // Try to extract JSON array if it exists
            const jsonMatch = mainContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
            let finalComments = [];

            if (jsonMatch) {
                try {
                    // It might be wrapped in ```json ... ```, extract the array part only
                    const jsonStr = jsonMatch[0];
                    finalComments = JSON.parse(jsonStr);
                    console.log("[AiAssistant] Parsed JSON Comments:", finalComments.length);

                    // Optional: If we successfully parsed JSON, maybe we only want to show a summary in the bubble?
                    // Generate a dynamic summary based on the content of comments
                    const generateReviewSummary = (comments) => {
                        const tags = new Set();
                        const fullText = comments.map(c => c.message).join(' ');

                        // Simple Keyword Matching
                        if (/定价|积分|费用|钱|收费|价格/.test(fullText)) tags.add("定价策略");
                        if (/合规|法律|风险|法务/.test(fullText)) tags.add("合规风险");
                        if (/逻辑|矛盾|冲突|错误/.test(fullText)) tags.add("逻辑漏洞");
                        if (/格式|标点|日期|排版|错别字/.test(fullText)) tags.add("规范性");
                        if (/模糊|歧义|不明确|未说明/.test(fullText)) tags.add("表述清晰度");

                        const tagArray = Array.from(tags);
                        const focusArea = tagArray.length > 0
                            ? `发现在 **${tagArray.slice(0, 2).join('、')}** 等方面存在问题`
                            : "发现若干细节有待优化";

                        return `本次审查${focusArea}，共定位到 ${comments.length} 个潜在风险点，详情请查看右侧列表。`;
                    };

                    // Apply summary to BOTH Auto-Review (Button) and Intent-Based Review (Chat)
                    mainContent = generateReviewSummary(finalComments);

                } catch (e) {
                    console.error("JSON Parse failed", e);
                }
            }

            // 3. Update UI State (Finalize)
            setMessages(prev => prev.map(msg =>
                msg.key === aiMessageId
                    ? {
                        ...msg,
                        isThinking: false,
                        thoughtContent: finalThoughtDisplay, // Show the full mock log + finished status
                        content: mainContent,
                        originalRawContent: rawText // Keep raw for history
                    }
                    : msg
            ));

            // 4. Pass Data to Parent (Phase 3 will finalize this)
            if (finalComments.length > 0 && typeof onTriggerAiReview === 'function') {
                // Forward compatibility hook
                onTriggerAiReview(finalComments);
            }


        } catch (error) {
            console.error('[AiAssistantSidebar] Error:', error);
            const errorMessage = {
                key: `error_${Date.now()}`,
                role: 'ai',
                content: '抱歉，发生了错误。请稍后再试。'
            };
            setMessages(prev => [...prev, errorMessage]);
            // Remove the placeholder if it failed completely
            setMessages(prev => prev.filter(m => m.key !== aiMessageId));
        } finally {
            setLoading(false);
        }
    };

    // --- Bubble Render Config ---
    // --- Bubble Render Config ---
    const renderBubbleContent = (msg) => {
        // If it's a simple string (old messages), render as is
        if (typeof msg === 'string') {
            return <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg}</div>;
        }

        return (
            <div className="flex flex-col gap-2">
                {(msg.isThinking || msg.thoughtContent) && (
                    <div className="rounded-lg overflow-hidden mb-2">
                        {/* Use Ant Design X Think Component */}
                        <ThoughtChain
                            items={msg.thoughtContent ? [{ title: 'Thinking Process', content: msg.thoughtContent }] : []}
                            status={msg.isThinking ? 'pending' : 'success'}
                            collapsible
                        />
                    </div>
                )}

                {/* Main Content */}
                {(msg.content || !msg.isThinking) && (
                    <div className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.isThinking && !msg.content ? 'animate-pulse opacity-50' : ''}`}>
                        {msg.content}
                    </div>
                )}
            </div>
        );
    };

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#8b5cf6', // Violet
                    colorBgContainer: '#27272a',
                    colorBgElevated: '#3f3f46',
                    colorText: '#e4e4e7',
                    colorTextSecondary: '#a1a1aa',
                    borderRadius: 12,
                },
                components: {
                    // Sender input styling
                    Input: {
                        colorBgContainer: '#18181b',
                        colorBorder: '#3f3f46',
                        colorText: '#e4e4e7',
                        colorTextPlaceholder: '#71717a',
                    }
                }
            }}
        >
            <div className="w-[380px] h-full flex flex-col bg-zinc-900 rounded-xl overflow-hidden">
                {/* --- Header --- */}
                <div className="h-14 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-semibold text-zinc-100">AI Assistant</span>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/20 text-violet-400">
                        Kimi
                    </span>
                </div>

                {/* --- Message List (Scrollable) --- */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 chat-panel-dark"
                >
                    {messages.map((msg) => (
                        <div
                            key={msg.key}
                            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                            {/* Avatar */}
                            {msg.role === 'ai' ? <AIAvatar /> : <UserAvatar />}

                            {/* Bubble */}
                            <Bubble
                                placement={msg.role === 'user' ? 'end' : 'start'}
                                content={renderBubbleContent(msg)}
                                styles={{
                                    content: {
                                        maxWidth: '260px',
                                        background: msg.role === 'user' ? '#3f3f46' : '#27272a',
                                        border: msg.role === 'user' ? '1px solid #52525b' : '1px solid #3f3f46',
                                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        padding: '12px 16px',
                                        color: '#e4e4e7',
                                    }
                                }}
                            />
                        </div>
                    ))}


                </div>

                {/* === Input Area - 自动撑高布局 === */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 10px 20px 10px',
                    background: '#101010',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                }}>
                    {/* 按钮区域 */}
                    <div style={{
                        flexShrink: 0,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        paddingBottom: '10px',
                        boxSizing: 'border-box',
                    }}>
                        <button
                            style={{
                                height: '28px',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '5px 16px',
                                background: '#1F1F1F',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#2a2a2a'}
                            onMouseLeave={(e) => e.target.style.background = '#1F1F1F'}
                            onClick={() => {
                                console.log('[AiAssistantSidebar] 虚拟代理自动审查 clicked');
                                if (onTriggerAiReview) {
                                    // With the new logic we set handleSend(null, true) inside.
                                    // But onTriggerAiReview passed from parent is the OLD handleAiReview.
                                    // We want to trigger OUR internal review.
                                    // Wait, if I click THIS button, I want to trigger the internal sidebar logic.
                                    // BUT, the button 'onTriggerAiReview' is passed from parent.
                                    // If parent passed 'handleAiReview' (the legacy one), we shouldn't use it if we want the NEW logic.
                                    // Actually, the plan is to link the TOP button in DualRoleView to THIS component.
                                    // THIS button inside the sidebar is "Virtual Agent Auto Review".
                                    // Let's call the internal handleSend(null, true) directly here.
                                    // And MAYBE call onTriggerAiReview if we still want to support legacy side-effects?
                                    // No, let's switch to internal logic primarily.
                                    handleSend(null, true);
                                } else {
                                    handleSend(null, true);
                                }
                            }}
                        >
                            <span style={{
                                whiteSpace: 'nowrap',
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontFamily: 'PingFang SC, -apple-system, sans-serif',
                                fontSize: '12px',
                                lineHeight: '18px',
                                fontWeight: 400,
                            }}>
                                虚拟代理自动审查
                            </span>
                        </button>
                    </div>

                    {/* 输入框容器 - 固定高度100px */}
                    <div className="w-full px-4 pb-4"> {/* Container padding */}
                        <Sender
                            loading={loading}
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={(v) => handleSend(v, false)}
                            placeholder="输入或将文件拖至此处..."
                            // Force the structure to allow absolute positioning
                            className="
                                h-[128px] 
                                !bg-[#27272a] 
                                rounded-xl 
                                border border-zinc-700 
                                relative 
                                overflow-hidden
                                
                                /* 1. Fix the Input Area (Top-Left Alignment) */
                                [&_.ant-x-sender-content]:h-full
                                [&_.ant-x-sender-input]:h-full
                                [&_textarea]:!h-full
                                [&_textarea]:!resize-none
                                [&_textarea]:!bg-transparent
                                [&_textarea]:!pt-[10px]     /* Top Padding */
                                [&_textarea]:!pl-[16px]     /* Left Padding */
                                [&_textarea]:!pr-[60px]     /* Right Padding (Avoid button overlap) */
                                [&_textarea]:text-zinc-200
                                [&_textarea]:placeholder:text-zinc-500
                                
                                /* 2. Fix the Button Position (Bottom-Right Absolute) */
                                [&_.ant-x-sender-actions]:absolute
                                [&_.ant-x-sender-actions]:bottom-[10px]
                                [&_.ant-x-sender-actions]:right-[16px]
                                [&_.ant-x-sender-actions]:!m-0
                            "
                            // Clean up default Ant styles that might conflict
                            style={{
                                '--x-sender-bg': 'transparent',
                                '--x-sender-border': 'none',
                            }}
                        />
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}
);

export default AiAssistantSidebar;
