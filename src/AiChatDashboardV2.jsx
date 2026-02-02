import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import MockSplitView from './MockSplitView';
import ThinkingAccordion from './components/ThinkingAccordion';
import Drawer from './components/Drawer';
import { eventBus, EVENTS } from './utils/eventBus';
import { IconAI, IconMenu, IconSend } from './svg-icons';
import { DOCUMENT_CONTENT } from './data/documentModel';
import { sendMessageToKimi } from './services/kimiService';
import { toBackend, fromBackendBatch } from './utils/commentAdapter';

// ==========================================
// CommentCard Component with Inline Reply
// ==========================================
function CommentCard({ comment, isActive, onClick, onReply }) {
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const [replyValue, setReplyValue] = useState('');
    const textareaRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [replyValue]);

    // Focus textarea when reply opens
    useEffect(() => {
        if (isReplyOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isReplyOpen]);

    const handleReplyClick = (e) => {
        e.stopPropagation();
        setIsReplyOpen(true);
    };

    const handleSubmitReply = (e) => {
        e?.stopPropagation();
        if (!replyValue.trim()) return;

        onReply?.(comment.id, replyValue.trim());
        setReplyValue('');
        setIsReplyOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmitReply();
        }
        if (e.key === 'Escape') {
            setIsReplyOpen(false);
            setReplyValue('');
        }
    };

    const handleCancelReply = (e) => {
        e.stopPropagation();
        setIsReplyOpen(false);
        setReplyValue('');
    };

    return (
        <div
            onClick={() => onClick(comment.id, comment.anchor?.blockId)}
            className={`
                p-3 rounded-lg border cursor-pointer transition-all group
                ${isActive
                    ? 'bg-yellow-900/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.05)]'
                    : 'bg-[#2C2C2C] border-zinc-800 hover:border-zinc-700'
                }
            `}
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${comment.type?.includes('AI') ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                    <span className={`font-bold text-sm ${comment.type?.includes('AI') ? 'text-purple-300' : 'text-zinc-300'}`}>
                        {comment.user}
                    </span>
                </div>
                {/* <span className="text-[10px] text-zinc-500">{new Date(comment.created_at).toLocaleTimeString()}</span> */}
            </div>

            {/* Quoted Text */}
            {comment.anchor?.quote && (
                <div className="mb-2 text-xs text-zinc-500 bg-zinc-900 p-1.5 rounded border-l-2 border-zinc-700 truncate font-mono select-none">
                    "{comment.anchor.quote}"
                </div>
            )}

            {/* Content */}
            <div className="text-sm text-zinc-200 leading-relaxed break-words">
                {comment.content}
            </div>

            {/* Threaded Replies - Render BEFORE input box */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 space-y-2 bg-[#252525] rounded-md p-2">
                    {comment.replies.map(reply => (
                        <div key={reply.id} className="text-sm leading-snug">
                            <span className="text-zinc-400 font-medium">{reply.user}:</span>
                            <span className="text-zinc-300 ml-1.5">{reply.content}</span>
                            {/* <span className="text-[10px] text-zinc-600 ml-2">
                                {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span> */}
                        </div>
                    ))}
                </div>
            )}

            {/* Reply Input Area - Always at the bottom */}
            <div className="mt-3 pt-2 border-t border-zinc-700/50">
                {!isReplyOpen ? (
                    /* Default State: Subtle Reply Placeholder */
                    <button
                        onClick={handleReplyClick}
                        className="w-full text-left px-2.5 py-1.5 rounded-md bg-[#1E1E1E] border border-zinc-800 
                                   text-xs text-zinc-500 hover:text-zinc-400 hover:border-zinc-700 
                                   transition-all placeholder-style"
                    >
                        回复...
                    </button>
                ) : (
                    /* Active State: Auto-resizing Textarea with Send Button */
                    <div
                        className="bg-[#1E1E1E] rounded-md border border-zinc-700 p-2 space-y-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <textarea
                            ref={textareaRef}
                            value={replyValue}
                            onChange={(e) => setReplyValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入回复..."
                            rows={1}
                            className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-600 
                                       resize-none outline-none leading-relaxed min-h-[24px] max-h-[120px]"
                        />
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleCancelReply}
                                className="text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors px-1"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmitReply}
                                disabled={!replyValue.trim()}
                                className={`
                                    flex items-center justify-center w-6 h-6 rounded-md transition-all flex-shrink-0
                                    ${replyValue.trim()
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
                                `}
                            >
                                {/* FIX: Explicit icon sizing with w-4 h-4 */}
                                <span className="w-4 h-4 flex-shrink-0">
                                    <IconSend />
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Lazy load config to avoid cycles
const AppConfig = lazy(() => import('./App').then(m => ({ default: m.default })));

// ==========================================
// 1. CLEAN DATA SEED (Fallback)
// ==========================================
const SEED_COMMENTS_V2 = [
    {
        id: "v2_init_001",
        user: "产品经理",
        content: "价格字体太小了，建议调大。",
        anchor: { blockId: "block-card-team-price", quote: "25积分" },
        created_at: Date.now() - 100000,
        type: "client-ai",
        replies: [
            { id: "reply_001_1", user: "我", content: "收到，马上调整。", created_at: Date.now() - 90000 },
            { id: "reply_001_2", user: "产品经理", content: "谢谢，还需要加粗吗？", created_at: Date.now() - 85000 }
        ]
    },
    {
        id: "v2_init_002",
        user: "法务",
        content: "这里必须明确年份，避免歧义。",
        anchor: { blockId: "block-section-3-item-1", quote: "2026 年 1 月 26 日" },
        created_at: Date.now() - 80000,
        type: "client-ai",
        replies: []
    },
    {
        id: "v2_init_003",
        user: "CTO",
        content: "性能指标需要更具体，比如 P99。",
        anchor: { blockId: "block-rule-perf-val", quote: "0分/次" },
        created_at: Date.now() - 60000,
        type: "client-ai",
        replies: [
            { id: "reply_003_1", user: "我", content: "已添加 P99 ≤ 200ms 的约束。", created_at: Date.now() - 50000 }
        ]
    }
];

const MOCK_THOUGHTS = [
    "正在初始化多模态视觉扫描模型...",
    "已识别关键 UI 区域：[定价卡片]、[功能列表]、[底部条款]...",
    "正在进行 OCR 文字提取与语义分析...",
    "深度检查：检测到“25积分”与背景对比度略低 (WCAG 标准)...",
    "逻辑校验：正在比对“免费缓冲期”日期与 SLA 协议数据库...",
    "正在生成结构化审查建议..."
];

export default function AiChatDashboardV2() {
    // --- State ---
    const [comments, setComments] = useState(SEED_COMMENTS_V2); // Start with V2 Seed
    const [activeId, setActiveId] = useState(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // AI States
    const [isReviewing, setIsReviewing] = useState(false);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [thinkingMessage, setThinkingMessage] = useState(null); // For AI Review accordion

    // Selection / Toolbar State (From Demo)
    const [selectedText, setSelectedText] = useState('');
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [toolbarPosition, setToolbarPosition] = useState(null);
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const scrollContainerRef = useRef(null);

    // --- Effects ---

    // 1. Initial Data Fetch - Uses adapter for backend → frontend conversion
    // 1. Initial Data Fetch - Uses adapter for backend → frontend conversion
    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await axios.get('/api/comments');
                if (res.data.success) {
                    const dbComments = res.data.data.comments || [];

                    // Use adapter to convert backend format to frontend format
                    const v2Comments = fromBackendBatch(dbComments);

                    if (v2Comments.length > 0) {
                        console.log("[FetchComments] Loaded from backend:", v2Comments.length);

                        // MERGE STRATEGY: Keep seed comments visible for demo, append backend comments
                        // This ensures "preset comments" don't disappear on refresh
                        setComments(prev => {
                            // Note: 'prev' is SEED_COMMENTS_V2 on initial load
                            // We deduplicate by ID just in case
                            const existingIds = new Set(prev.map(c => c.id));
                            const uniqueBackend = v2Comments.filter(c => !existingIds.has(c.id));
                            return [...prev, ...uniqueBackend];
                        });
                    } else {
                        console.log("[FetchComments] No valid comments from backend, keeping seed data");
                    }
                }
            } catch (err) {
                console.error("Failed to fetch comments", err);
            }
        };
        fetchComments();
    }, []);


    // --- Handlers (From Demo) ---

    // 1. Handle Selection
    const handleTextSelect = useCallback(({ blockId, text, rect }) => {
        if (!text) {
            setToolbarPosition(null);
            setIsInputOpen(false);
            return;
        }
        setSelectedText(text);
        setSelectedBlockId(blockId);
        setToolbarPosition({ top: rect.bottom + 10, left: rect.left });
        setIsInputOpen(false);
    }, []);

    // 2. Open Input
    const handleOpenInput = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsInputOpen(true);
    };

    // 3. Submit Comment (Manual) - Uses adapter for frontend → backend conversion
    const handleSubmit = async () => {
        if (!inputValue.trim()) return;

        // CRITICAL VALIDATION: Must have selected text to create valid anchor
        if (!selectedText || !selectedText.trim()) {
            console.warn("[ManualComment] Cannot submit: No text selected");
            // alert("请先选中文档中的文字，再添加评论"); // Optional: User feedback
            return;
        }

        const newComment = {
            id: `v2_manual_${Date.now()}`,
            user: "我 (Project Owner)",
            content: inputValue,
            anchor: { blockId: selectedBlockId, quote: selectedText },
            created_at: Date.now(),
            type: "HUMAN_CLIENT",
            replies: []
        };

        // Optimistic Update (keep frontend format for immediate display)
        setComments(prev => [...prev, newComment]);

        // Reset UI
        setInputValue('');
        setIsInputOpen(false);
        setToolbarPosition(null);
        setSelectedText('');
        setActiveId(newComment.id);

        // Upload to Backend using adapter for format conversion
        try {
            const backendPayload = toBackend(newComment);
            console.log("[ManualComment] Saving to backend:", backendPayload);
            await axios.post('/api/comments', backendPayload);
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    // 4. Click Comment
    const handleCommentClick = (id, blockId) => {
        setActiveId(id);
        if (blockId) {
            const el = document.getElementById(blockId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // 5. Handle Reply (Threaded - appends to specific comment's replies array)
    const handleReply = async (parentId, replyContent) => {
        const newReply = {
            id: `reply_${Date.now()}`,
            user: "我",
            content: replyContent,
            created_at: Date.now()
        };

        // Threaded Update: Append to specific comment's replies array
        setComments(prev => prev.map(c =>
            c.id === parentId
                ? { ...c, replies: [...(c.replies || []), newReply] }
                : c
        ));

        // Upload to Backend: Use the dedicated REPLY endpoint
        // POST /api/comments/:id/reply
        try {
            console.log(`[Reply] Saving reply to comment ${parentId}`);
            await axios.post(`/api/comments/${parentId}/reply`, {
                reply_content: replyContent,
                view_role: 'client' // Assuming client role for manual replies
            });
        } catch (e) { console.error("Reply save failed", e); }
    };




    // --- AI Logic (Real Kimi API Integration) ---

    // Helper: Find the blockId for a given quote by searching all document blocks
    // Uses fuzzy matching as fallback to ensure anchor is always valid
    const findBlockIdForQuote = (quote) => {
        if (!quote || !quote.trim()) {
            console.warn("[findBlockIdForQuote] Empty quote, using default block");
            return DOCUMENT_CONTENT[0]?.id || "block-doc-title"; // Default fallback
        }

        const searchQuote = quote.trim();

        // 1. Exact match
        for (const block of DOCUMENT_CONTENT) {
            if (block.text && block.text.includes(searchQuote)) {
                console.log("[findBlockIdForQuote] Exact match found:", block.id);
                return block.id;
            }
        }

        // 2. Fuzzy match: Check if any significant substring matches
        // This handles cases where AI slightly paraphrases the quote
        const words = searchQuote.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            for (const block of DOCUMENT_CONTENT) {
                if (!block.text) continue;
                const matchCount = words.filter(word => block.text.includes(word)).length;
                // If more than 50% of significant words match
                if (matchCount >= Math.ceil(words.length * 0.5)) {
                    console.log("[findBlockIdForQuote] Fuzzy match found:", block.id, "matchCount:", matchCount);
                    return block.id;
                }
            }
        }

        // 3. Last resort: Use first content block as fallback
        console.warn("[findBlockIdForQuote] No match found for:", searchQuote.substring(0, 30), "... using first block");
        return DOCUMENT_CONTENT[0]?.id || "block-doc-title";
    };

    // 1. AI Review - Real Implementation
    const handleAiReview = async () => {
        if (isReviewing) return;
        setIsReviewing(true);

        // Show Thinking Accordion in Sidebar
        const tempId = `thinking_${Date.now()}`;
        setThinkingMessage({ id: tempId, type: 'thinking' });

        try {
            // Step 1: Construct the PRD content string from document model
            const prdContent = DOCUMENT_CONTENT.map(block => block.text).join('\n\n');

            // Step 2: Build the System Prompt (The "Secret Sauce")
            const systemPrompt = `You are a ruthless Senior PM. Review the PRD content below.
Identify 3-4 distinct issues (ambiguities, missing definitions, or logic risks).

Output format (Strict JSON Array):
[
  {
    "quote": "exact text from document",
    "message": "concise critique"
  }
]

CRITICAL RULES:
1. The "quote" MUST be an exact copy-paste from the source text. Do not paraphrase. If the quote is not exact, the system breaks.
2. Return ONLY the raw JSON array. Do not wrap in markdown code blocks.
3. Language: Chinese (Simplified).

PRD Content:
${prdContent}`;

            // Step 3: Call the Kimi API
            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: "请开始审查这份 PRD 文档，找出其中的问题。" }
            ];

            console.log("[AI Review] Calling Kimi API...");
            const rawResponse = await sendMessageToKimi(messages);
            console.log("[AI Review] Raw Response:", rawResponse);

            // Step 4: Parse the JSON Response (with safety)
            let parsedReviews = [];
            try {
                // Clean up potential markdown code block wrappers
                let cleanedResponse = rawResponse.trim();
                if (cleanedResponse.startsWith("```json")) {
                    cleanedResponse = cleanedResponse.slice(7);
                }
                if (cleanedResponse.startsWith("```")) {
                    cleanedResponse = cleanedResponse.slice(3);
                }
                if (cleanedResponse.endsWith("```")) {
                    cleanedResponse = cleanedResponse.slice(0, -3);
                }
                cleanedResponse = cleanedResponse.trim();

                parsedReviews = JSON.parse(cleanedResponse);

                if (!Array.isArray(parsedReviews)) {
                    throw new Error("Response is not an array");
                }
            } catch (parseError) {
                console.error("[AI Review] JSON Parse Error:", parseError);
                // Fallback: Create a generic error comment
                parsedReviews = [{
                    quote: "",
                    message: `AI 返回格式异常，原始内容：${rawResponse.substring(0, 200)}...`
                }];
            }

            // Step 5: Hydrate comments into our UI schema
            // Note: findBlockIdForQuote now always returns a valid blockId (with fallback)
            const newAiComments = parsedReviews
                .filter(review => review.quote && review.quote.trim()) // Only keep reviews with quotes
                .map((review, index) => {
                    const blockId = findBlockIdForQuote(review.quote);
                    const quote = review.quote.trim();

                    return {
                        id: `ai_rev_${Date.now()}_${index}`,
                        user: "AI 审查员",
                        content: review.message || "无具体建议",
                        // CRITICAL: Always construct valid anchor object
                        anchor: {
                            blockId: blockId,
                            quote: quote,
                            offset: 0 // Optional but good for future use
                        },
                        created_at: Date.now(),
                        type: "AI_CLIENT",
                        replies: []
                    };
                });

            console.log("[AI Review] Generated Comments:", newAiComments);

            // Step 6: Update state and persist to backend
            if (newAiComments.length > 0) {
                // Optimistic UI update first
                setComments(prev => [...prev, ...newAiComments]);

                // Save to backend in parallel using adapter
                try {
                    const savePromises = newAiComments.map(comment => {
                        const backendPayload = toBackend(comment);
                        console.log("[AI Review] Saving comment:", backendPayload);
                        return axios.post('/api/comments', backendPayload);
                    });
                    await Promise.all(savePromises);
                    console.log("[AI Review] All comments saved to backend successfully");
                } catch (saveError) {
                    console.error("[AI Review] Failed to save some comments:", saveError);
                    // Comments are already in UI, just log the error
                }
            } else {
                console.warn("[AI Review] No valid comments generated (quotes may not match)");
            }

        } catch (error) {
            console.error("[AI Review] Error:", error);
            // Show error as a temporary comment
            const errorComment = {
                id: `ai_error_${Date.now()}`,
                user: "系统提示",
                content: `AI 审查失败: ${error.message || '未知错误'}`,
                anchor: null,
                created_at: Date.now(),
                type: "ERROR",
                replies: []
            };
            setComments(prev => [...prev, errorComment]);
        } finally {
            setIsReviewing(false);
            setThinkingMessage(null);
        }
    };


    return (
        <div className="flex h-full w-full bg-black text-white font-sans overflow-hidden">
            {/* Drawer for Config */}
            <Drawer isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="系统配置">
                <Suspense fallback={<div className="p-4">Loading Config...</div>}>
                    <AppConfig isEmbedded={true} />
                </Suspense>
            </Drawer>

            {/* --- Left: Document View --- */}
            <div className="flex-1 relative flex flex-col border-r border-zinc-900">
                <div className="h-14 border-b border-zinc-900 flex items-center justify-between px-5 bg-black/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-base text-zinc-100">📄 PRD Review (V2)</span>
                        <span className="text-[10px] tracking-wide bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                            FEISHU CORE
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAiReview}
                            disabled={isReviewing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border
                                ${isReviewing
                                    ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-white text-black border-white hover:bg-zinc-200 hover:border-zinc-200 shadow-sm'}
                            `}
                        >
                            <IconAI className="w-3.5 h-3.5" />
                            {isReviewing ? 'AI Reviewing...' : 'AI Review'}
                        </button>
                        <button
                            onClick={() => setIsConfigOpen(true)}
                            className="p-2 hover:bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition-colors"
                        >
                            <IconMenu className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scroll Container */}
                <div className="flex-1 relative overflow-hidden">
                    <div className="h-full w-full overflow-hidden" ref={scrollContainerRef}>
                        <MockSplitView
                            activeId={activeId}
                            comments={comments}
                            onTextSelect={handleTextSelect}
                            isThinking={isReviewing} // Show overlay on Doc too? User liked overlays.
                            isReviewing={isReviewing}
                            // Dummies
                            activeSection={null}
                            onSelectElement={() => { }}
                            isLegacyMode={false}
                            isFallbackActive={false}
                        />
                    </div>
                </div>

                {/* Floating Toolbar */}
                {toolbarPosition && (
                    <div
                        style={{ position: 'fixed', top: toolbarPosition.top, left: toolbarPosition.left, zIndex: 9999 }}
                        className="animate-in fade-in zoom-in duration-200"
                    >
                        {!isInputOpen ? (
                            <button
                                onClick={handleOpenInput}
                                onMouseDown={e => e.preventDefault()}
                                className="bg-zinc-800 border border-zinc-600 shadow-xl text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 flex items-center gap-2"
                            >
                                💬 Add Comment
                            </button>
                        ) : (
                            <div className="bg-zinc-800 border border-zinc-600 shadow-2xl rounded-lg p-3 w-72 flex flex-col gap-2">
                                <div className="text-xs text-zinc-400 border-l-2 border-yellow-500 pl-2 mb-1 truncate">Target: "{selectedText}"</div>
                                <textarea
                                    autoFocus
                                    className="bg-black/50 border border-zinc-700 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                                    rows={3}
                                    placeholder="Type your comment..."
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsInputOpen(false)} className="text-xs text-zinc-400 hover:text-white px-2">Cancel</button>
                                    <button onClick={handleSubmit} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-500 font-medium">Post</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- Right: Comment Sidebar --- */}
            <div className="w-[340px] bg-zinc-900 flex flex-col border-l border-zinc-800">
                <div className="h-14 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50">
                    <span className="font-medium">Comments ({comments.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Thinking Item Integration */}
                    {thinkingMessage && (
                        <div className="p-3 bg-zinc-900/80 border border-indigo-500/30 rounded-lg animate-pulse">
                            <ThinkingAccordion
                                loading={true}
                                thoughts={MOCK_THOUGHTS}
                                duration={4000}
                            />
                        </div>
                    )}

                    {comments.map(c => (
                        <CommentCard
                            key={c.id}
                            comment={c}
                            isActive={activeId === c.id}
                            onClick={handleCommentClick}
                            onReply={handleReply}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
