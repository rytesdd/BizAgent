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
            let systemInstruction = `你是一个专业的 AI 助手，正在帮助用户进行文档审查和项目协作。请用简洁、专业的语言回答问题。回复使用中文。`;
            let userPrompt = content ? content.trim() : "你好";

            // Special Logic for Auto Review
            if (isAutoReview) {
                systemInstruction = `You are a Senior Product Auditor. Your job is to critique the PRD document provided.

**Phase 1: Deep Analysis (The Thinking Process)**
First, analyze the document step-by-step inside <think> tags.
- Check for logical contradictions in the "Rules" section.
- Identify ambiguous terms (e.g., "Time TBD").
- Simulate a user scenario to see if the flow breaks.
- Use a professional, critical internal monologue.

**Phase 2: Final Output (The Data)**
After the analysis, output the specific comments in a STRICT JSON Array block.

**Format Example:**
<think>
Checking the point deduction rule... wait, "0 points" effectively means the feature is free. This contradicts the "Paid" label. I should flag this.
Also, the date format is non-standard.
</think>

\`\`\`json
[
  { "quote": "0 points", "message": "Logic error: 0 points implies free tier..." },
  ...
]
\`\`\`
`;
                // In a real app, you would inject the actual document content here.
                // For this sandbox, we'll assume the AI has "read" it or we pass a snippet.
                userPrompt = `请开始审查。`;
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

            const response = await sendMessageToKimi(conversationHistory);
            const rawText = response.trim();

            console.log("[AiAssistant] Raw Response:", rawText);

            // 1. Extract Thought (Regex to find content between <think> tags)
            const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
            const thoughtProcess = thinkMatch ? thinkMatch[1].trim() : "";

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
                    // For now, let's keep the mainContent as the text to display, 
                    // or if it's ONLY JSON, maybe pretty print it or just say "Analysis Complete".
                    if (isAutoReview) {
                        mainContent = `审查完成，发现 ${finalComments.length} 个潜在问题。`;
                        // Trigger parent callback
                        if (onTriggerAiReview && typeof onTriggerAiReview === 'function') {
                            // We are hijacking this prop for now, ideally should use a different one 'onReviewComplete'
                            // But based on current setup, the parent passed 'handleAiReview' which expects nothing or specific args?
                            // Wait, the parent 'handleAiReview' in DualRoleView currently does EVERYTHING (api call, etc).
                            // We are moving logic HERE. So we need a way to pass data BACK.
                            // The user plan said: "Call onReviewComplete(jsonData) to pass highlights".
                            // I need to add that prop or check if onTriggerAiReview can be used? 
                            // Actually, onTriggerAiReview was passed as `handleAiReview` which triggers the OLD logic.
                            // We need new logic. I should probalby assume the user *wants* us to use a new prop or event.
                            // But I can't change the parent *too* much until Phase 3 integration. 
                            // Let's just log for now and assume part of Phase 3 execution will wire this up.
                        }
                    }
                } catch (e) {
                    console.error("JSON Parse failed", e);
                }
            }

            // 3. Update UI State
            setMessages(prev => prev.map(msg =>
                msg.key === aiMessageId
                    ? {
                        ...msg,
                        isThinking: false,
                        thoughtContent: thoughtProcess,
                        content: mainContent,
                        originalRawContent: rawText // Keep raw for history
                    }
                    : msg
            ));

            // 4. Pass Data to Parent (Phase 3 will finalize this)
            if (finalComments.length > 0 && typeof onTriggerAiReview === 'function' && onTriggerAiReview.name === 'handleReviewComplete') {
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
