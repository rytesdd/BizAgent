/**
 * AiAssistantSidebar - AI Chat Interface using Ant Design X
 * 
 * A fixed-width sidebar for conversational AI assistance.
 * Uses @ant-design/x Bubble and Sender components.
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { ConfigProvider, theme } from 'antd';
import { sendMessageToKimi } from '../services/kimiService';
import { reviewDocumentStream } from '../services/reviewService';
import { DOCUMENT_CONTENT } from '../data/documentModel';
import ThinkingAccordion from '../components/ThinkingAccordion';
import MessageRenderer from '../components/MessageRenderer';
import AiPersonaConfigModal from '../components/AiPersonaConfigModal';
import { sendPersonaChat } from '../services/kimiService';

// ==========================================
// Icon Components
// ==========================================
const IconSettings = (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

const IconSparkles = (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

const IconImage = (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
    </svg>
);

const IconBulb = (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

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
const AiAssistantSidebarV3 = forwardRef(({ onTriggerAiReview, currentRole = 'PARTY_A', onWidgetClick, className = '' }, ref) => {
    // --- State: 独立的消息状态（甲方/乙方隔离）---
    const [clientMessages, setClientMessages] = useState([
        // Initial state is empty for "Zero State" look, or we filter it out visually
        {
            key: 'welcome_client',
            role: 'ai',
            content: '你好！我是你的 BizAgent 业务助手。有什么可以帮助你的吗？'
        }
    ]);
    const [vendorMessages, setVendorMessages] = useState([
        {
            key: 'welcome_vendor',
            role: 'ai',
            content: '你好！我是你的 BizAgent 业务助手。有什么可以帮助你的吗？'
        }
    ]);

    // 根据当前角色动态选择消息状态
    const messages = currentRole === 'PARTY_A' ? clientMessages : vendorMessages;
    const setMessages = currentRole === 'PARTY_A' ? setClientMessages : setVendorMessages;

    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');

    // Persona Config State
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [personaConfig, setPersonaConfig] = useState({
        vendor: {},
        client: {}
    });

    // 流式审查状态
    const [isReviewing, setIsReviewing] = useState(false);
    const [thinkingLog, setThinkingLog] = useState('');
    const abortControllerRef = useRef(null);

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
    }, [messages, loading, thinkingLog]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // --- Send Message Handler ---
    // --- Send Message Handler ---
    const handleSend = async (content, isAutoReview = false, intent = null) => {
        // Allow empty content if it's an auto-review trigger (which sends a system prompt instruction as user message equivalent)
        if (!isAutoReview && (!content || !content.trim())) return;

        // ========================================
        // DEBUG: /test_cards command
        // Injects mock widgets for UI testing
        // Uses new "Narrative Stream" format with contentBlocks
        // ========================================
        if (content && content.trim() === '/test_cards') {
            const mockNarrativeMessage = {
                key: `debug_${Date.now()}`,
                role: 'ai',
                isThinking: false,
                // NEW: contentBlocks array for Narrative Stream experience
                contentBlocks: [
                    // 1. The Hook (Situation)
                    {
                        type: 'markdown',
                        content: '### 📊 深度商机复盘：四川政务大数据三期\n\n基于最新的情报扫描，该项目的基本面非常强劲，赢单胜率已锁定在 **92%**。但不要掉以轻心，我们在 ROI 测算上还有优化空间：'
                    },
                    {
                        type: 'component_group',
                        layoutHint: 'stacked',
                        widgets: [
                            {
                                type: 'snapshot',
                                data: {
                                    label: '赢单胜率',
                                    value: '92.0%', // Updated to match text
                                    title: '四川省政务大数据平台三期扩容项目',
                                    trend: 'up',
                                    kvPairs: {
                                        '契合度': '95%',
                                        '竞争情况': '低'
                                    }
                                }
                            },
                            {
                                type: 'snapshot',
                                data: {
                                    label: '预估 ROI',
                                    value: '2.8M',
                                    title: '预计回报周期：18个月',
                                    trend: 'flat',
                                    kvPairs: {
                                        '关键人': '张处长',
                                        '关系紧密度': '高'
                                    }
                                }
                            }
                        ]
                    },

                    // 2. The Conflict (Complication)
                    {
                        type: 'markdown',
                        content: '🚨 **然而，外部环境发生了突发变量**。监测到两条可能影响交付周期的红色预警，建议优先处理：'
                    },
                    {
                        type: 'component_group',
                        layoutHint: 'stacked',
                        widgets: [
                            {
                                type: 'notification',
                                data: {
                                    level: 'warning',
                                    title: '竞争对手价格策略变动',
                                    message: 'Aliyun 于今日发布了针对政务市场的"Lite版"方案，报价可能低于预算 40%。建议立即启动价值锁定流程。',
                                    source: '竞品情报雷达',
                                    time: '10分钟前'
                                }
                            },
                            {
                                type: 'notification',
                                data: {
                                    level: 'danger',
                                    title: '投标截止时间临近',
                                    message: '四川省政务大数据三期项目投标截止日期为 2026-02-20，距今仅剩 11 天。',
                                    source: '项目日程',
                                    time: '系统提醒'
                                }
                            }
                        ]
                    },

                    // 3. The Diagnosis (Analysis)
                    {
                        type: 'markdown',
                        content: '为了应对这一风险，我们需要重新审视决策链。目前的卡点在于 **张处长**。虽然他总体支持，但他对 *"资金合规"* 的顾虑（Pain Point）可能被竞争对手利用。这是他的最新画像：'
                    },
                    {
                        type: 'component_group',
                        layoutHint: 'stacked',
                        widgets: [
                            {
                                type: 'key_person',
                                data: {
                                    name: '张处长',
                                    role: '四川省大数据中心 · 项目负责人',
                                    stance: 'Support',
                                    influence: 'High',
                                    pain_point: '对数据治理能力有高要求，担忧供应商难以落地"全链路溯源"功能'
                                }
                            }
                        ]
                    },

                    // 4. The Evidence (Product Fit)
                    {
                        type: 'markdown',
                        content: '技术层面我们依然占据制高点。对比最新的 PRD，我们的产品与需求匹配度高达 **95%**，这足以抵消部分价格劣势：'
                    },
                    {
                        type: 'component_group',
                        layoutHint: 'stacked',
                        widgets: [
                            {
                                type: 'feature_list',
                                data: {
                                    doc_name: '三期建设需求规格说明书_v1.0.pdf',
                                    match_score: '95%',
                                    core_features: ['数据中台', '全链路治理', '智能分析', '可视化大屏', '安全合规'],
                                    missing: 'None'
                                }
                            }
                        ]
                    },

                    // 5. The Solution (Action)
                    {
                        type: 'markdown',
                        content: '👉 **基于以上研判，我生成了今日的行动清单**。请务必在本周五前完成对张处长的 “合规性” 定点爆破：'
                    },
                    {
                        type: 'component_group',
                        layoutHint: 'stacked',
                        widgets: [
                            {
                                type: 'todo',
                                data: {
                                    task: '联系张处长确认技术方案评审时间，重点准备"全链路溯源"演示',
                                    assignee: '李明 (售前)',
                                    deadline: '2026-02-12',
                                    priority: 'P0',
                                    status: 'Todo'
                                }
                            },
                            {
                                type: 'todo',
                                data: {
                                    task: '制作竞品对比分析报告，突出我方在数据治理方面的优势',
                                    assignee: '王芳 (产品)',
                                    deadline: '2026-02-14',
                                    priority: 'P1',
                                    status: 'In Progress'
                                }
                            }
                        ]
                    }
                ]
            };

            setInputValue('');
            setMessages(prev => [...prev,
            { key: `user_${Date.now()}`, role: 'user', content: '/test_cards' },
                mockNarrativeMessage
            ]);
            console.log('[DEBUG] /test_cards triggered - injected Narrative Stream message');
            return;
        }



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
            isThinking: true,
            widgets: []  // Array to hold parsed widget objects
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
            // Special Logic for Auto Review (Button Trigger) - USE STREAMING API
            if (isAutoReview) {
                // 使用流式 API 进行审查
                setIsReviewing(true);
                setThinkingLog('');

                // 创建 AbortController
                abortControllerRef.current = new AbortController();

                await reviewDocumentStream({
                    prdText: documentText,
                    signal: abortControllerRef.current.signal,
                    onDelta: (chunk) => {
                        // 可选：记录所有 delta 用于调试
                        // console.log('[Stream Delta]', chunk);
                    },
                    onThinking: (thinkingContent) => {
                        // 实时更新思考日志
                        setThinkingLog(thinkingContent);

                        // 同时更新消息中的 thoughtContent
                        setMessages(prev => prev.map(msg =>
                            msg.key === aiMessageId
                                ? { ...msg, thoughtContent: thinkingContent }
                                : msg
                        ));
                    },
                    onComplete: ({ comments, thinkingContent }) => {
                        console.log('[AiAssistant] Stream complete:', {
                            commentCount: comments.length,
                            thinkingLength: thinkingContent.length
                        });

                        // 生成审查摘要
                        const generateReviewSummary = (commentList) => {
                            const tags = new Set();
                            const fullText = commentList.map(c => c.content || c.message || '').join(' ');

                            // 关键词匹配
                            if (/定价|积分|费用|钱|收费|价格/.test(fullText)) tags.add("定价策略");
                            if (/合规|法律|风险|法务/.test(fullText)) tags.add("合规风险");
                            if (/逻辑|矛盾|冲突|错误/.test(fullText)) tags.add("逻辑漏洞");
                            if (/格式|标点|日期|排版|错别字/.test(fullText)) tags.add("规范性");
                            if (/模糊|歧义|不明确|未说明/.test(fullText)) tags.add("表述清晰度");

                            const tagArray = Array.from(tags);
                            const focusArea = tagArray.length > 0
                                ? `发现在 **${tagArray.slice(0, 2).join('、')}** 等方面存在问题`
                                : "发现若干细节有待优化";

                            return `本次审查${focusArea}，共定位到 ${commentList.length} 个潜在风险点，详情请查看右侧列表。`;
                        };

                        const summaryContent = comments.length > 0
                            ? generateReviewSummary(comments)
                            : "审查完成，未发现明显风险点。";

                        // 更新消息状态
                        setMessages(prev => prev.map(msg =>
                            msg.key === aiMessageId
                                ? {
                                    ...msg,
                                    isThinking: false,
                                    thoughtContent: thinkingContent + '\n[系统] 分析完成，生成报告如下。',
                                    content: summaryContent,
                                    isStreamComplete: true
                                }
                                : msg
                        ));

                        // 传递评论给父组件
                        if (comments.length > 0 && typeof onTriggerAiReview === 'function') {
                            // 转换为父组件期望的格式
                            const formattedComments = comments.map(c => ({
                                quote: c.quoted_text || c.quote || '',
                                message: c.content || c.message || ''
                            }));
                            onTriggerAiReview(formattedComments);
                        }

                        setIsReviewing(false);
                        setLoading(false);
                    },
                    onError: (error) => {
                        console.error('[AiAssistant] Stream error:', error);
                        setMessages(prev => prev.map(msg =>
                            msg.key === aiMessageId
                                ? {
                                    ...msg,
                                    isThinking: false,
                                    content: `审查过程中发生错误: ${error.message}`
                                }
                                : msg
                        ));
                        setIsReviewing(false);
                        setLoading(false);
                    }
                });

                // 流式处理结束后不需要继续执行下面的逻辑
                return;
            }

            // --- NORMAL CHAT MODE (Use Persona Engine) ---
            // If not auto-review, use the new Persona Engine
            if (!isAutoReview) {
                const currentPersona = currentRole === 'PARTY_A' ? 'client' : 'vendor';
                const currentConfig = personaConfig[currentPersona];

                // Build simple history for backend
                const historyForBackend = messages
                    .filter(m => m.role === 'user' || m.role === 'ai')
                    .slice(-10)
                    .map(m => {
                        let msgContent = '';
                        // 优先使用 string content
                        if (typeof m.content === 'string' && m.content.trim()) {
                            msgContent = m.content;
                        } else if (m.contentBlocks && m.contentBlocks.length > 0) {
                            // 从 contentBlocks（Narrative Engine 格式）中提取文本
                            msgContent = m.contentBlocks
                                .filter(b => b.type === 'markdown' && b.content)
                                .map(b => b.content)
                                .join('\n\n');
                        } else if (m.content && typeof m.content !== 'string') {
                            msgContent = JSON.stringify(m.content);
                        }
                        // 确保 content 永远不为空（API 会拒绝空消息）
                        if (!msgContent) {
                            msgContent = m.role === 'ai' ? '(已回复)' : '(空消息)';
                        }
                        return {
                            role: m.role === 'ai' ? 'assistant' : 'user',
                            content: msgContent
                        };
                    });

                // Add current user prompt
                historyForBackend.push({ role: 'user', content: userPrompt });

                // Call Persona Chat API
                const data = await sendPersonaChat(
                    historyForBackend,
                    currentPersona,
                    currentConfig,
                    intent
                );

                // Parse response: extract markdown content and widgets
                const responseWidgets = data.widgets || [];
                let contentBlocks = [];
                let fallbackContent = "";

                // Use the mixed stream (Narrative Engine)
                if (responseWidgets.length > 0) {
                    contentBlocks = responseWidgets;
                } else if (data._debug?.raw) {
                    // Fallback if no widgets parsed but raw text exists
                    fallbackContent = data._debug.raw;
                }

                setMessages(prev => prev.map(msg =>
                    msg.key === aiMessageId
                        ? {
                            ...msg,
                            isThinking: false,
                            contentBlocks: contentBlocks, // MIXED STREAM: Text + Cards interleaved
                            content: fallbackContent,     // Legacy fallback
                            widgets: [],                  // Clear legacy widgets to avoid duplication
                            thoughtContent: "",
                        }
                        : msg
                ));

                setLoading(false);
                return;
            }

            // --- LEGACY AUTO REVIEW LOGIC BELOW (Only if isAutoReview is true) ---

            systemInstruction = `你是一个专业的 AI 助手，正在帮助用户进行文档审查和项目协作。
你的知识库中已经包含了当前 PRD 文档的内容。

=== 当前 PRD 文档内容 ===
${documentText}
=== 文档结束 ===

${reviewInstructions}

** 交互策略 **
1. 如果用户只是进行日常提问或闲聊（例如"你好"、"文档里讲了什么"），请用自然语言回答，**不要**输出 JSON。
2. 如果用户明确要求进行"审查"、"挑刺"、"找问题"（例如"看看文档有什么问题"、"检查计费规则"），请立即执行审查逻辑，并**必须**输出上述 JSON 格式。`;

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
                        content: m.content
                    })),
                { role: 'user', content: userPrompt }
            ];

            // 普通聊天模式：使用假的思考动画
            let thoughtAccumulator = "";
            const GENERAL_LOG = `正在接收用户指令...
加载上下文环境...
正在理解意图...
检索相关知识库...
构建回答逻辑...
正在组织语言...`;

            const typingInterval = setInterval(() => {
                if (thoughtAccumulator.length < GENERAL_LOG.length) {
                    const nextChunk = GENERAL_LOG.slice(thoughtAccumulator.length, thoughtAccumulator.length + Math.floor(Math.random() * 3) + 1);
                    thoughtAccumulator += nextChunk;

                    setMessages(prev => prev.map(msg =>
                        msg.key === aiMessageId
                            ? { ...msg, thoughtContent: thoughtAccumulator }
                            : msg
                    ));
                }
            }, 50);

            const response = await sendMessageToKimi(conversationHistory);

            // --- Widget Parsing State Machine ---
            // Parse <widget>...</widget> tags from response
            const parseWidgetsFromContent = (rawContent) => {
                const widgets = [];
                let cleanContent = '';
                let remaining = rawContent;
                let isInsideWidget = false;
                let widgetBuffer = '';

                while (remaining.length > 0) {
                    if (isInsideWidget) {
                        const endIdx = remaining.indexOf('</widget>');
                        if (endIdx === -1) {
                            // Tag not closed, add to buffer
                            widgetBuffer += remaining;
                            break;
                        } else {
                            // End tag found
                            widgetBuffer += remaining.slice(0, endIdx);
                            // Try to parse JSON
                            try {
                                const widgetData = JSON.parse(widgetBuffer.trim());
                                widgets.push(widgetData);
                                console.log('[AiAssistant] Parsed widget:', widgetData);
                            } catch (e) {
                                console.warn('[AiAssistant] Failed to parse widget JSON:', e, widgetBuffer);
                            }
                            widgetBuffer = '';
                            remaining = remaining.slice(endIdx + 9); // Skip </widget>
                            isInsideWidget = false;
                        }
                    } else {
                        const startIdx = remaining.indexOf('<widget>');
                        if (startIdx === -1) {
                            // No more widgets, append rest to clean content
                            cleanContent += remaining;
                            break;
                        } else {
                            // Widget tag found
                            cleanContent += remaining.slice(0, startIdx);
                            remaining = remaining.slice(startIdx + 8); // Skip <widget>
                            isInsideWidget = true;
                        }
                    }
                }

                return { cleanContent: cleanContent.trim(), widgets };
            };

            // API Finished: Clear typing interval
            clearInterval(typingInterval);

            const rawText = response.trim();
            console.log("[AiAssistant] Raw Response:", rawText);

            // --- Parse widgets from response ---
            const { cleanContent: contentWithoutWidgets, widgets: parsedWidgets } = parseWidgetsFromContent(rawText);

            // Extract JSON if present (for review comments)
            let mainContent = contentWithoutWidgets;
            const jsonMatch = contentWithoutWidgets.match(/\[\s*\{[\s\S]*\}\s*\]/);
            let finalComments = [];

            if (jsonMatch) {
                try {
                    finalComments = JSON.parse(jsonMatch[0]);
                    console.log("[AiAssistant] Parsed JSON Comments:", finalComments.length);

                    // Generate summary
                    const generateReviewSummary = (comments) => {
                        const tags = new Set();
                        const fullText = comments.map(c => c.message || c.content || '').join(' ');

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

                    mainContent = generateReviewSummary(finalComments);

                } catch (e) {
                    console.error("JSON Parse failed", e);
                }
            }

            // Update UI State with parsed widgets
            const finalThoughtDisplay = thoughtAccumulator + "\n[系统] 分析完成。";
            setMessages(prev => prev.map(msg =>
                msg.key === aiMessageId
                    ? {
                        ...msg,
                        isThinking: false,
                        thoughtContent: finalThoughtDisplay,
                        content: mainContent,
                        widgets: parsedWidgets,  // Add parsed widgets to message
                        originalRawContent: rawText
                    }
                    : msg
            ));

            // Pass Data to Parent
            if (finalComments.length > 0 && typeof onTriggerAiReview === 'function') {
                onTriggerAiReview(finalComments);
            }

        } catch (error) {
            console.error('[AiAssistantSidebar] Error:', error);
            setMessages(prev => prev.filter(m => m.key !== aiMessageId));
            setMessages(prev => [...prev, {
                key: `error_${Date.now()}`,
                role: 'ai',
                content: '抱歉，发生了错误。请稍后再试。'
            }]);
        } finally {
            setLoading(false);
            setIsReviewing(false);
        }
    };

    const handleConfigSave = (newConfig) => {
        setPersonaConfig(newConfig);
        console.log('[AiAssistant] Persona Config Saved:', newConfig);
    };

    // --- Bubble Render Config ---
    // --- Bubble Render Config ---
    const renderBubbleContent = (msg) => {
        // If it's a simple string (old messages), render as is
        if (typeof msg === 'string') {
            return <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg}</div>;
        }

        // Determine if we should show MessageRenderer
        const hasNarrativeContent = msg.contentBlocks && msg.contentBlocks.length > 0;
        const hasLegacyContent = msg.content || (msg.widgets && msg.widgets.length > 0);
        const shouldShowContent = hasNarrativeContent || hasLegacyContent || !msg.isThinking;

        return (
            <div className="flex flex-col gap-2">
                {/* Thinking Accordion - supports both fake timer and real-time streaming */}
                {(msg.isThinking || msg.thoughtContent) && (
                    <ThinkingAccordion
                        loading={msg.isThinking}
                        realTimeLogs={msg.thoughtContent || null}
                    />
                )}

                {/* Main Content + Widgets using MessageRenderer */}
                {shouldShowContent && (
                    <MessageRenderer
                        contentBlocks={msg.contentBlocks}
                        content={msg.content}
                        widgets={msg.widgets || []}
                        isThinking={msg.isThinking && !msg.content && !hasNarrativeContent}
                        onWidgetClick={onWidgetClick}
                    />
                )}
            </div>
        );
    };


    // --- Gemini UI Logic ---
    // Check if there are any user messages to determine "Zero State"
    const isZeroState = !messages.some(m => m.role === 'user');

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#4F4F4F',
                    colorBgContainer: '#1e1f20', // Lighter gray for cards
                    colorBgElevated: '#2d2d30',
                    colorText: '#e3e3e3',
                    colorTextSecondary: '#a1a1aa',
                    borderRadius: 24, // High border radius
                },
                components: {
                    Input: {
                        colorBgContainer: '#1e1f20',
                        colorBorder: 'transparent', // No border
                        colorText: '#e3e3e3',
                        colorTextPlaceholder: '#71717a',
                    }
                }
            }}
        >
            {/* Main Container: Deep Black #131314 */}
            <div className={`w-full h-full flex flex-col bg-[#131314] overflow-hidden relative ${className}`}>

                {/* --- Header: Minimal/Transparent --- */}
                <div className={`
                    h-14 flex items-center justify-between px-6 shrink-0 z-20 transition-all duration-500
                    ${isZeroState ? 'bg-transparent' : 'bg-[#131314]/80 backdrop-blur-md'}
                `}>
                    <div className="flex items-center gap-3">
                        {/* Only show "BizAgent" in active state or keep it subtle */}
                        <span className={`font-semibold text-zinc-100 transition-opacity duration-500 ${isZeroState ? 'opacity-0' : 'opacity-100'}`}>
                            BizAgent
                        </span>
                    </div>

                    {/* Settings Icon - Always visible or hidden? Keep visible for access */}
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="p-2 -mr-2 text-zinc-400 hover:text-zinc-100 transition-colors rounded-full hover:bg-zinc-800"
                        title="AI 人设配置"
                    >
                        <IconSettings className="w-5 h-5" />
                    </button>
                </div>

                <AiPersonaConfigModal
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    onSave={handleConfigSave}
                    initialConfig={personaConfig}
                />

                {/* --- Hero Section (Zero State Only) --- */}
                <div
                    className={`
                        absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10
                        transition-opacity duration-700 ease-in-out pb-32
                        ${isZeroState ? 'opacity-100' : 'opacity-0'}
                    `}
                >
                    <div className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570]">
                        Hello, {currentRole === 'PARTY_A' ? 'Client' : 'Vendor'}
                    </div>
                    <div className="text-3xl text-[#6b6b6b] font-medium">How can I help you today?</div>
                </div>

                {/* --- Message List --- */}
                <div
                    ref={scrollRef}
                    className={`
                        flex-1 overflow-y-auto px-5 py-4 space-y-6 z-0
                        transition-opacity duration-500 delay-200
                        ${isZeroState ? 'opacity-0' : 'opacity-100'}
                    `}
                >
                    {messages.map((msg, index) => {
                        // Skip the initial welcome message if we are in Zero State mode (logic handled by opacity)
                        // But also skip it ensuring it doesn't flash.
                        // Actually, let's render everything, opacity handles visibility.
                        return (
                            <div
                                key={msg.key}
                                className={`flex gap-4 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar - Hide AI Avatar */}
                                {msg.role === 'ai' ? (
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                                        <IconSparkles className="w-5 h-5 text-zinc-400" />
                                    </div>
                                ) : <UserAvatar />}

                                {/* Bubble Container */}
                                <div className={`flex flex-col w-full max-w-3xl ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    {/* Bubble */}
                                    <Bubble
                                        placement={msg.role === 'user' ? 'end' : 'start'}
                                        content={renderBubbleContent(msg)}
                                        styles={{
                                            content: {
                                                maxWidth: '100%',
                                                width: msg.role === 'user' ? 'auto' : '100%',
                                                background: msg.role === 'user' ? '#2e2f33' : 'transparent', // Darker gray for user
                                                borderRadius: msg.role === 'user' ? '24px' : '0',
                                                padding: msg.role === 'user' ? '14px 20px' : '0',
                                                color: '#e4e4e7',
                                                fontSize: '15px',
                                                lineHeight: '1.6',
                                            }
                                        }}
                                        variant="borderless" // Remove default borders
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* === Input Area === */}
                <div
                    className={`
                        w-full flex-shrink-0 flex flex-col items-center justify-end
                        transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)]
                        ${isZeroState ? 'h-[50vh]' : 'h-auto pb-6'}
                    `}
                >
                    <div className="w-full max-w-[800px] px-4 relative flex flex-col items-center">

                        {/* Input Box - Floating Card Style */}
                        <div className={`
                            w-full transition-all duration-500 relative z-20
                            ${isZeroState ? 'scale-105' : 'scale-100'}
                        `}>
                            <Sender
                                loading={loading}
                                value={inputValue}
                                onChange={setInputValue}
                                onSubmit={(v) => handleSend(v, false)}
                                placeholder="Enter a prompt here"
                                className={`
                                    !bg-[#1e1f20] 
                                    !rounded-[28px] 
                                    !border-none
                                    !shadow-none
                                    relative 
                                    overflow-hidden
                                    transition-all duration-300
                                    ${isZeroState ? 'h-[160px]' : 'h-[64px]'}
                                    
                                    /* Input Field Styling */
                                    [&_.ant-x-sender-input]:!bg-transparent
                                    [&_textarea]:!bg-transparent
                                    [&_textarea]:!text-zinc-200
                                    [&_textarea]:!text-[16px]
                                    [&_textarea]:!placeholder-zinc-500
                                    [&_textarea]:!px-6
                                    ${isZeroState ? '[&_textarea]:!pt-6' : '[&_textarea]:!pt-4'}
                                    
                                    /* Actions Button Styling */
                                    [&_.ant-x-sender-actions]:absolute
                                    [&_.ant-x-sender-actions]:!bottom-3
                                    [&_.ant-x-sender-actions]:!right-4
                                `}
                                style={{
                                    '--x-sender-bg': '#1e1f20',
                                }}
                            />
                        </div>

                        {/* Suggestion Chips - Zero State Only (Now Below Input) */}
                        <div className={`
                            flex gap-3 mt-6 justify-center transition-all duration-500 z-10
                            ${isZeroState ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'}
                        `}>
                            {[
                                { icon: <IconImage className="w-4 h-4" />, label: 'Create image' },
                                { icon: <IconBulb className="w-4 h-4" />, label: 'Brainstorm' },
                                { icon: <IconSparkles className="w-4 h-4" />, label: 'Analyze Data' },
                                { icon: <span className="text-xs font-bold">...</span>, label: 'More' }
                            ].map((chip, i) => (
                                <button
                                    key={i}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1e1f20] hover:bg-[#2e2f33] text-zinc-300 text-sm font-medium transition-colors border border-transparent hover:border-zinc-700"
                                    onClick={() => handleSend(`Thinking about ${chip.label}...`, false)} // Demo action
                                >
                                    {chip.icon}
                                    {chip.label}
                                </button>
                            ))}
                        </div>

                        <div className={`text-center mt-8 text-xs text-zinc-600 transition-opacity duration-500 ${isZeroState ? 'opacity-100' : 'opacity-0 hidden'}`}>
                            Gemini may display inaccurate info, including about people, so double-check its responses.
                        </div>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}
);

export default AiAssistantSidebarV3;
