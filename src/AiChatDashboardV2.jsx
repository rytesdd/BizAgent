import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import MockSplitView from './MockSplitView';
import ThinkingAccordion from './components/ThinkingAccordion';
import Drawer from './components/Drawer';
import { eventBus, EVENTS } from './utils/eventBus';
import { IconAI, IconMenu, IconSend } from './svg-icons';

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
        type: "client-ai"
    },
    {
        id: "v2_init_002",
        user: "法务",
        content: "这里必须明确年份，避免歧义。",
        anchor: { blockId: "block-section-3-item-1", quote: "2026 年 1 月 26 日" },
        created_at: Date.now() - 80000,
        type: "client-ai"
    },
    {
        id: "v2_init_003",
        user: "CTO",
        content: "性能指标需要更具体，比如 P99。",
        anchor: { blockId: "block-rule-perf-val", quote: "0分/次" },
        created_at: Date.now() - 60000,
        type: "client-ai"
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

    // 1. Initial Data Fetch (Optional - if we want to sync with DB)
    // For V2, we might want to filtered DB fetch OR just rely on local state for now?
    // Let's implement a "Smart Fetch" that only keeps V2-compatible data.
    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await axios.get('/api/comments');
                if (res.data.success) {
                    const dbComments = res.data.data.comments || [];
                    // STRICT FILTER: Only accept comments with ANCHOR
                    const v2Comments = dbComments.filter(c => c.anchor && c.anchor.blockId && c.anchor.quote);

                    if (v2Comments.length > 0) {
                        // Merge with seed? Or just use them?
                        // Let's use them, but fallback to seed if empty
                        setComments(v2Comments);
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

    // 3. Submit Comment (Manual)
    const handleSubmit = async () => {
        if (!inputValue.trim()) return;

        const newComment = {
            id: `v2_manual_${Date.now()}`,
            user: "我 (Project Owner)",
            content: inputValue,
            anchor: { blockId: selectedBlockId, quote: selectedText },
            created_at: Date.now(),
            type: "HUMAN_CLIENT"
        };

        // Optimistic Update
        setComments(prev => [...prev, newComment]);

        // Reset UI
        setInputValue('');
        setIsInputOpen(false);
        setToolbarPosition(null);
        setSelectedText('');
        setActiveId(newComment.id);

        // Upload to Backend (Fire and forget or wait?)
        try {
            await axios.post('/api/comments', newComment);
        } catch (e) { console.error("Save failed", e); }
    };

    // 4. Click Comment
    const handleCommentClick = (id, blockId) => {
        setActiveId(id);
        if (blockId) {
            const el = document.getElementById(blockId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };


    // --- AI Logic (Ported from v1 but adapted) ---

    // 1. AI Review
    const handleAiReview = async () => {
        if (isReviewing) return;
        setIsReviewing(true);

        // Show Thinking Accordion in Sidebar? Or just a Overlay? 
        // User liked the Accordion in Chat Stream, but here we have a Comment List.
        // Let's add a "Thinking Item" to the comment list temporarily!
        const tempId = `thinking_${Date.now()}`;
        setThinkingMessage({ id: tempId, type: 'thinking' });

        // Simulate Delay
        setTimeout(async () => {
            try {
                // Call Backend (Simulation for now as backend might generate old format)
                // We will MOCK the response to ensure V2 format.
                // In real prod, we'd update backend prompt. Here we simulate.

                const newAiComments = [
                    {
                        id: `ai_rev_${Date.now()}_1`,
                        user: "AI 审查员",
                        content: "此处不仅需要展示积分，建议增加法币价值对照。",
                        anchor: { blockId: "block-card-team-price", quote: "25积分" },
                        created_at: Date.now(),
                        type: "AI_CLIENT"
                    },
                    {
                        id: `ai_rev_${Date.now()}_2`,
                        user: "AI 审查员",
                        content: "SLA 赔付标准缺失，建议补充。",
                        anchor: { blockId: "block-section-3-item-2", quote: "99.9%" }, // Assuming exists
                        created_at: Date.now(),
                        type: "AI_CLIENT"
                    }
                ];

                setComments(prev => [...prev, ...newAiComments]);
                // Save to DB
                // await axios.post('/api/comments', newAiComments);

            } catch (e) {
                console.error(e);
            } finally {
                setIsReviewing(false);
                setThinkingMessage(null);
            }
        }, 4000);
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
                    <div className="h-full w-full overflow-y-auto" ref={scrollContainerRef}>
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

                    {comments.map(c => {
                        const isActive = activeId === c.id;
                        return (
                            <div
                                key={c.id}
                                onClick={() => handleCommentClick(c.id, c.anchor?.blockId)}
                                className={`
                                    p-3 rounded-lg border cursor-pointer transition-all group
                                    ${isActive
                                        ? 'bg-yellow-900/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.05)]'
                                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${c.type?.includes('AI') ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                                        <span className={`font-bold text-sm ${c.type?.includes('AI') ? 'text-purple-300' : 'text-zinc-300'}`}>
                                            {c.user}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleTimeString()}</span>
                                </div>

                                {c.anchor?.quote && (
                                    <div className="mb-2 text-xs text-zinc-500 bg-zinc-900 p-1.5 rounded border-l-2 border-zinc-700 truncate font-mono select-none">
                                        "{c.anchor.quote}"
                                    </div>
                                )}

                                <div className="text-sm text-zinc-200 leading-relaxed break-words">
                                    {c.content}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
