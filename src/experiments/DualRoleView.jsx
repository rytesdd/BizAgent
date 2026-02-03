import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import MockSplitView from '../MockSplitView';




import Drawer from '../components/Drawer';
import AiAssistantSidebar from '../components/AiAssistantSidebar';
import { IconAI, IconMenu, IconSend } from '../svg-icons';
import { DOCUMENT_CONTENT } from '../data/documentModel';
import { sendMessageToKimi } from '../services/kimiService';
import { eventBus, EVENTS } from '../utils/eventBus';
import axios from 'axios';
import AgentProcessCycle from '../components/AgentProcessCycle';



// ==========================================
// Trash Icon Component
// ==========================================
function IconTrash({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
    );
}

// Helper for Display Names
// Helper for Display Names
const getDisplayName = (name) => {
    const map = {
        "Client": "甲方",
        "Party A": "甲方",
        "Product Manager": "甲方",
        "Me (PM)": "甲方",
        "甲方产品经理": "甲方",
        "我 (甲方)": "甲方",
        "Vendor": "乙方",
        "Party B": "乙方",
        "Vendor Team": "乙方",
        "Me (Vendor)": "乙方",
        "乙方团队": "乙方",
        "我 (乙方)": "乙方",
        "Vendor Agent": "乙方 AI 智能回复"
    };
    if (map[name]) return map[name];
    if (name && name.startsWith("Me (Vendor")) return "乙方";
    return name;
};

// ==========================================
// CommentCard Component (Reused)
// ==========================================
function CommentCard({ comment, isActive, onClick, onReply, onDelete }) {
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const [replyValue, setReplyValue] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [replyValue]);

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
            id={`comment-${comment.id}`}
            onClick={() => onClick(comment.id, comment.anchor?.blockId)}
            className={`
                p-3 rounded-lg cursor-pointer transition-all group
                ${isActive
                    ? 'bg-[#2C2C2C]'
                    : 'bg-[#2C2C2C] hover:bg-[#333333]'
                }
            `}
        >
            {/* 1. Quote Context (Moved to Top & Transparent) */}
            {comment.anchor?.quote && (
                <div className={`mb-2 text-xs text-zinc-500 bg-transparent border-l-2 pl-2 truncate font-mono select-none ${isActive ? 'border-[#FFB30F]' : 'border-zinc-700'}`}>
                    "{comment.anchor.quote}"
                </div>
            )}

            {/* 2. User Info & Timestamp (Moved to Second Row) */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${comment.type?.includes('AI') ? 'bg-[#2B5CD9]' :
                        (comment.user === 'Vendor Agent' || comment.user === '乙方 AI 智能回复') ? 'bg-orange-500' : 'bg-green-500'
                        }`}></div>
                    <span className={`font-bold text-sm ${comment.type?.includes('AI') ? 'text-[#aaccff]' :
                        (comment.user === 'Vendor Agent' || comment.user === '乙方 AI 智能回复') ? 'text-orange-300' : 'text-zinc-300'
                        }`}>
                        {getDisplayName(comment.user)}
                    </span>
                    {/* Badge for Bot */}
                    {(comment.user === 'Vendor Agent' || comment.user === '乙方 AI 智能回复') && (
                        <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                            BOT
                        </span>
                    )}
                </div>
                {/* Timestamp + Delete Button */}
                <div className="flex items-center gap-2">
                    {/* <span className="text-[10px] text-zinc-500">{new Date(comment.created_at).toLocaleTimeString()}</span> */}
                    {/* Delete Button - appears on hover */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(comment.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all duration-200"
                        title="删除评论"
                    >
                        <IconTrash className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* 3. Comment Content */}
            <div className="text-sm text-zinc-200 leading-relaxed break-words">
                {comment.content}
            </div>

            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 space-y-2 bg-[#252525] rounded-md p-2">
                    {comment.replies.map(reply => (
                        <div key={reply.id} className="text-sm leading-snug">
                            <span className="text-zinc-400 font-medium">{getDisplayName(reply.user)}:</span>
                            <span className="text-zinc-300 ml-1.5">{reply.content}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 pt-2">
                {!isReplyOpen ? (
                    <button
                        onClick={handleReplyClick}
                        className="w-full text-left px-2.5 py-1.5 rounded-md bg-[#1E1E1E]
                                   text-xs text-zinc-500 hover:text-zinc-400 hover:bg-[#252525] 
                                   transition-all placeholder-style"
                    >
                        回复...
                    </button>
                ) : (
                    <div
                        className="bg-[#1E1E1E] rounded-md p-2 space-y-2"
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
const AppConfig = lazy(() => import('../App').then(m => ({ default: m.default })));

// ==========================================
// SEED DATA (Isolated)
// ==========================================
const SEED_COMMENTS_SANDBOX = [
    {
        id: "v2_init_001",
        user: "产品经理",
        content: "价格字体太小了，建议调大。",
        anchor: { blockId: "block-card-team-price", quote: "25积分", uiRef: "ui-price-card" },
        created_at: Date.now() - 100000,
        type: "client-ai",
        replies: []
    }
];



// LocalStorage key for persistence
const STORAGE_KEY = 'dualrole_sandbox_comments';

// ==========================================
// AGENT PERSONA TEMPLATES
// ==========================================
const STRATEGIES = {
    // 1. Scope Defense (范围防御)
    display_name_scope_defense: "Scope Defense", // Key mapper
    Scope_Defense: "你是一个寸步不让的乙方项目经理。你的核心目标是严格捍卫SOW（工作说明书）边界，拒绝任何超出原定范围的需求。语气要专业但强硬，强调变更流程和额外成本。",

    // 2. Empathy First (同理优先)
    Empathy_First: "你是一个善解人意的合作伙伴。你要先充分肯定客户的初衷，表达深刻理解，然后再委婉地提出解决方案。如果必须拒绝，要给出替代方案，寻求共赢。",

    // 3. Technical Authority (技术权威)
    Technical_Authority: "你是一个资深技术架构师。用专业术语、技术可行性分析和架构视角来回应。强调系统的稳定性、性能和长期维护成本，建立不可质疑的权威感。",

    // 4. Vague Delay (模糊拖延) - From Config Controls
    Vague_Delay: "你是一个打太极的高手。不要直接答应也不要直接拒绝。使用模糊的词汇如“原则上可行”、“我们需要内部评估”、“后续迭代考虑”来拖延时间，保留回旋余地。"
};

const STYLES = {
    // 1. Concise
    Concise: "回复必须非常简练，50字以内，直击要点，不要废话。",

    // 2. Detailed
    Detailed: "回复需要详细解释背景、原因和上下文。逻辑严密，分点说明（1. 2. 3.），确保客户完全理解每一个细节。",

    // 3. Formal Letter
    Formal_Letter: "使用正式公函的格式。开头尊称，正文严肃得体，结尾致谢。用词考究，如同只有律师审核过的官方回复。"
};

// Default Config Keys
const DEFAULT_STRATEGY = 'Empathy_First';
const DEFAULT_STYLE = 'Detailed';

// ==========================================
// Helper: Load comments from localStorage or use seed
// Fix: Check if key EXISTS (not just if array has items)
// This ensures empty arrays are preserved after all comments are deleted
// Helper: Load comments from localStorage or use seed
// Fix: Merge SEED data to ensure new properties (like uiRef) are applied to existing persisted comments
const loadCommentsFromStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            let parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                // 1. Ensure all SEED comments are present and updated
                SEED_COMMENTS_SANDBOX.forEach(seed => {
                    const existingIdx = parsed.findIndex(p => p.id === seed.id);
                    if (existingIdx !== -1) {
                        // Exists: Update critical structure (anchor for UI highlighting) but Keep User Data (replies)
                        parsed[existingIdx] = {
                            ...parsed[existingIdx],
                            anchor: seed.anchor, // Force update anchor to get latest uiRef
                            // content: seed.content // Optional: keep user edits or force reset? Let's keep user edits if they edited text.
                        };
                    } else {
                        // Missing: Prepend to list (Treat as new default)
                        parsed.unshift(seed);
                    }
                });
                return parsed;
            }
        }
    } catch (e) {
        console.warn('[DualRole] Failed to load from localStorage:', e);
    }
    // Key doesn't exist → first time user, use seed data
    return SEED_COMMENTS_SANDBOX;
};

export default function DualRoleView() {
    // --- State ---
    const [comments, setComments] = useState(loadCommentsFromStorage);
    const [activeId, setActiveId] = useState(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // --- Dynamic Agent Config State ---
    const [vendorConfig, setVendorConfig] = useState({
        strategy: DEFAULT_STRATEGY,
        style: DEFAULT_STYLE
    });

    // Sync Config from Server/EventBus
    useEffect(() => {
        // 1. Initial Fetch
        const fetchConfig = async () => {
            try {
                const res = await axios.get('/api/config/ai');
                if (res.data.success && res.data.data?.vendor?.replier_mode) {
                    const { negotiation_strategy, response_length } = res.data.data.vendor.replier_mode;
                    setVendorConfig({
                        strategy: negotiation_strategy || DEFAULT_STRATEGY,
                        style: response_length || DEFAULT_STYLE
                    });
                    console.log('[DualRole] Config loaded:', { negotiation_strategy, response_length });
                }
            } catch (err) {
                console.warn('[DualRole] Failed to fetch initial config:', err);
            }
        };
        fetchConfig();

        // 2. Listen for Updates
        const unsubscribe = eventBus.on(EVENTS.CONFIG_UPDATED, (data) => {
            if (data?.vendorAiConfig?.replier_mode) {
                const { negotiation_strategy, response_length } = data.vendorAiConfig.replier_mode;
                setVendorConfig({
                    strategy: negotiation_strategy || DEFAULT_STRATEGY,
                    style: response_length || DEFAULT_STYLE
                });
                console.log('[DualRole] Config updated via EventBus:', { negotiation_strategy, response_length });
            }
        });

        return () => unsubscribe();
    }, []);

    // Persist comments to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
        } catch (e) {
            console.warn('[DualRole] Failed to save to localStorage:', e);
        }
    }, [comments]);

    // DUAL ROLE STATE
    const [currentRole, setCurrentRole] = useState('PARTY_A'); // 'PARTY_A' | 'PARTY_B'

    // AI States (Party A)

    // Agent States (Party B)
    const [agentEnabled, setAgentEnabled] = useState(false);
    const [isAgentTyping, setIsAgentTyping] = useState(false);

    // Selection / Toolbar State
    const [selectedText, setSelectedText] = useState('');
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [toolbarPosition, setToolbarPosition] = useState(null);
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const scrollContainerRef = useRef(null);

    // Track which comment IDs are currently being processed (prevent duplicate API calls)
    const processingIdsRef = useRef(new Set());

    // --- AGENT LOGIC (Party B) - "Sweeper" Mode ---
    // Scans ALL unanswered client comments and replies to each one
    useEffect(() => {
        // Gate: Only run when Agent is enabled
        if (!agentEnabled) return;

        // Helper: Check if a comment is from Party A (Client)
        const isFromClient = (comment) => {
            // Exclude: Vendor Agent (self)
            if (comment.user === "Vendor Agent" || comment.user === "乙方 AI 智能回复") return false;
            // Exclude: AI Reviewer (Purple Badge)
            if (comment.type === "AI_CLIENT") return false;
            if (comment.user === "AI 审查员") return false;
            if (comment.user?.includes("AI Assistant")) return false;
            // Exclude: Vendor Team
            if (comment.user === "Vendor Team" || comment.user === "乙方团队") return false;
            if (comment.user?.startsWith("Me (Vendor") || comment.user?.includes("乙方")) return false;
            // Everything else is considered Party A (Client)
            return true;
        };

        // Helper: Check if comment already has a Vendor reply
        const hasVendorReply = (comment) => {
            if (!comment.replies || comment.replies.length === 0) return false;
            return comment.replies.some(r =>
                r.user === "Vendor Agent" ||
                r.user === "乙方 AI 智能回复" ||
                r.user === "Me (Vendor)" ||
                r.user?.startsWith("Me (Vendor") ||
                r.user?.includes("乙方")
            );
        };

        // 1. SCAN: Find all pending (unanswered) client comments
        const pendingComments = comments.filter(c =>
            isFromClient(c) && !hasVendorReply(c)
        );

        if (pendingComments.length === 0) {
            return; // Nothing to process
        }

        console.log(`[DualRole Agent] Sweeper found ${pendingComments.length} unanswered comment(s)`);

        // 2. PROCESS: Reply to each pending comment (with concurrency control)
        const processComment = async (comment) => {
            // Skip if already being processed
            if (processingIdsRef.current.has(comment.id)) {
                return;
            }

            // Mark as processing
            processingIdsRef.current.add(comment.id);
            setIsAgentTyping(true);

            try {
                // --- DYNAMIC PROMPT CONSTRUCTION ---
                const strategyKey = vendorConfig.strategy;
                const styleKey = vendorConfig.style;

                const strategyPrompt = STRATEGIES[strategyKey] || STRATEGIES[DEFAULT_STRATEGY];
                const stylePrompt = STYLES[styleKey] || STYLES[DEFAULT_STYLE];

                // Extract PRD Context
                const documentText = DOCUMENT_CONTENT.map(b => b.text).join('\n\n');

                const systemPrompt = `
Role: 乙方项目经理 (Vendor Project Manager).
Current Task: Reply to a Client's comment on a PRD document.

=== PRD Document Context (Know this well) ===
${documentText}
=== End Context ===

Your Personality/Strategy:
${strategyPrompt}

Output Style Constraint:
${stylePrompt}

Reply Instructions:
1. You MUST read the "Client Quoted Text" to understand specific context.
2. Address the Client's concern specifically based on the PRD logic.
3. Be professional but defend your product logic if it makes sense, or offer a solution if it's a valid bug.
4. Reply in Chinese (Simplified).
5. **CRITICAL: Keep it short.** Max 3 sentences. No long explanations.
6. **Chat Style ONLY.** Do NOT use email format. NO "Dear Client", NO "Best Regards", NO "[Your Name]" placeholders. Just the answer.
`;

                // Construct detailed user context
                const quotedText = comment.anchor && comment.anchor.quote
                    ? comment.anchor.quote
                    : "(No specific text quoted, referring to general document)";

                const userContext = `
[Client Info]
Name: ${comment.user}

[Client Quoted Text]
"${quotedText}"

[Client Comment]
"${comment.content}"
`;

                const messages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContext }
                ];

                console.log(`[DualRole Agent] Replying to: "${comment.content.substring(0, 30)}..."`);
                const replyContent = await sendMessageToKimi(messages);

                // Append reply to the specific comment's replies array
                const newReply = {
                    id: `agent_reply_${Date.now()}_${comment.id}`,
                    user: "乙方 AI 智能回复",
                    content: replyContent,
                    created_at: Date.now()
                };

                setComments(prev => prev.map(c =>
                    c.id === comment.id
                        ? { ...c, replies: [...(c.replies || []), newReply] }
                        : c
                ));

                console.log(`[DualRole Agent] Replied successfully to comment ${comment.id}`);

            } catch (err) {
                console.error(`[DualRole Agent] Error replying to ${comment.id}:`, err);
            } finally {
                // Remove from processing set
                processingIdsRef.current.delete(comment.id);
            }
        };

        // 3. BATCH: Process all pending comments with delay between each
        const processBatch = async () => {
            for (const comment of pendingComments) {
                await processComment(comment);
                // Small delay between API calls
                await new Promise(r => setTimeout(r, 800));
            }
            // setIsAgentTyping(false) is now handled by the UI component's onComplete prop
        };

        // Start processing (with initial delay for UX)
        const timeoutId = setTimeout(() => processBatch(), 500);

        // Cleanup on unmount or dependency change
        return () => {
            clearTimeout(timeoutId);
        };

    }, [agentEnabled, comments]);


    // --- Handlers ---

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

        if (!selectedText || !selectedText.trim()) {
            return;
        }

        const newComment = {
            id: `v2_manual_${Date.now()}`,
            user: currentRole === 'PARTY_A' ? "甲方" : "乙方",
            content: inputValue,
            anchor: { blockId: selectedBlockId, quote: selectedText },
            created_at: Date.now(),
            type: "HUMAN_CLIENT",
            replies: []
        };

        setComments(prev => [...prev, newComment]);

        setInputValue('');
        setIsInputOpen(false);
        setToolbarPosition(null);
        setSelectedText('');
        setActiveId(newComment.id);
    };

    // 4. Click Comment (Toggle: click again to deselect)
    const handleCommentClick = (id, blockId) => {
        if (activeId === id) {
            // Already selected → deselect
            setActiveId(null);
        } else {
            // Select new card
            setActiveId(id);
            if (blockId) {
                const el = document.getElementById(blockId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    // 4.5 Handle Element Click (Reverse Lookup)
    const handleElementClick = (targetId) => {
        console.log("🖱️ [Interaction] User clicked Document Element:", targetId);

        const foundComment = comments.find(c =>
            c.anchor?.blockId === targetId || c.anchor?.uiRef === targetId
        );

        if (foundComment) {
            console.log("✅ [Interaction] Found Comment:", foundComment.id);
            setActiveId(foundComment.id);

            // Smooth Scroll Logic with Flash Effect
            const el = document.getElementById(`comment-${foundComment.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Temporary "Flash" effect to show visual feedback
                el.style.transition = "background 0.3s";
                el.style.backgroundColor = "#3f3f46"; // lighter gray flash
                setTimeout(() => el.style.backgroundColor = "", 500);
            } else {
                console.warn("⚠️ [Interaction] DOM Element not found for ID:", `comment-${foundComment.id}`);
            }
        } else {
            console.log("❌ [Interaction] No comment linked to this element.");
        }
    };

    // 5. Delete Comment (Persistent via localStorage effect)
    const handleDeleteComment = (id) => {
        setComments(prev => prev.filter(c => c.id !== id));
        // If deleted comment was active, clear activeId
        if (activeId === id) {
            setActiveId(null);
        }
    };

    // 5. Handle Reply (Manual)
    const handleReply = async (parentId, replyContent) => {
        const newReply = {
            id: `reply_${Date.now()}`,
            user: currentRole === 'PARTY_A' ? "甲方" : "乙方",
            content: replyContent,
            created_at: Date.now()
        };

        setComments(prev => prev.map(c =>
            c.id === parentId
                ? { ...c, replies: [...(c.replies || []), newReply] }
                : c
        ));
    };





    // --- AI Review Trigger (Linking to Sidebar) ---
    const sidebarRef = useRef(null);

    const handleAiReviewTrigger = () => {
        if (sidebarRef.current) {
            sidebarRef.current.triggerReview();
        }
    };

    // Callback when Sidebar finishes analysis (Data Passback)
    const handleAiAnalysisComplete = (newComments) => {
        if (!newComments || !Array.isArray(newComments)) return;

        console.log('[DualRole] Received analysis results:', newComments.length);

        const formattedComments = newComments.map((review, index) => ({
            id: `ai_rev_${Date.now()}_${index}`,
            user: "甲方虚拟代理",
            content: review.message,
            anchor: {
                blockId: findBlockIdForQuote(review.quote),
                quote: review.quote.trim(),
                offset: 0
            },
            created_at: Date.now(),
            type: "AI_CLIENT",
            replies: []
        }));

        setComments(prev => [...prev, ...formattedComments]);
    };

    // --- Helper for Anchor Linking ---
    const findBlockIdForQuote = (quote) => {
        if (!quote || !quote.trim()) return DOCUMENT_CONTENT[0]?.id || "block-doc-title";
        const searchQuote = quote.trim();
        for (const block of DOCUMENT_CONTENT) {
            if (block.text && block.text.includes(searchQuote)) return block.id;
        }
        const words = searchQuote.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            for (const block of DOCUMENT_CONTENT) {
                if (!block.text) continue;
                const matchCount = words.filter(word => block.text.includes(word)).length;
                if (matchCount >= Math.ceil(words.length * 0.5)) return block.id;
            }
        }
        return DOCUMENT_CONTENT[0]?.id || "block-doc-title";
    };

    return (
        <div className="absolute inset-4 flex flex-col text-white font-sans overflow-hidden gap-4">
            {/* Drawer for Config */}
            <Drawer isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="系统配置">
                <Suspense fallback={<div className="p-4">Loading Config...</div>}>
                    <AppConfig isEmbedded={true} />
                </Suspense>
            </Drawer>

            {/* ========================================== */}
            {/* TOP: Global Header (Full Width)           */}
            {/* ========================================== */}
            <div className="h-14 w-full flex items-center justify-between px-5 bg-zinc-900 rounded-xl shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-base text-zinc-100">Dual-Role Experiment</span>

                    {/* ROLE SWITCHER */}
                    <div className="flex bg-zinc-800 rounded-lg p-0.5 ml-4">
                        <button
                            onClick={() => setCurrentRole('PARTY_A')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentRole === 'PARTY_A'
                                ? 'bg-[#3B82F6] text-white shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                        >
                            甲方
                        </button>
                        <button
                            onClick={() => setCurrentRole('PARTY_B')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentRole === 'PARTY_B'
                                ? 'bg-[#3B82F6] text-white shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                        >
                            乙方
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* CONDITIONAL ACTION BUTTONS - AI Review 已隐藏，功能可通过语义触发 */}
                    {currentRole === 'PARTY_A' ? (
                        <button
                            onClick={handleAiReviewTrigger}
                            disabled={false} // Always enabled now, Sidebar manages state
                            style={{ display: 'none' }} // 隐藏按钮，保留代码便于恢复
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                                bg-white text-black hover:bg-zinc-200 shadow-sm
                            `}
                        >
                            <IconAI className="w-3.5 h-3.5" />
                            AI Review
                        </button>
                    ) : (
                        // PARTY B: Agent Toggle
                        <div className="flex items-center gap-3 bg-zinc-800 rounded-full px-3 py-1 text-xs">
                            {isAgentTyping && (
                                <AgentProcessCycle onComplete={() => setIsAgentTyping(false)} />
                            )}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">启用Agent自动回复</span>
                                <button
                                    onClick={() => setAgentEnabled(!agentEnabled)}
                                    className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${agentEnabled ? 'bg-green-500' : 'bg-zinc-600'
                                        }`}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${agentEnabled ? 'translate-x-4' : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="p-2 hover:bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition-colors"
                    >
                        <IconMenu className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ========================================== */}
            {/* BOTTOM: 3-Column Content Area             */}
            {/* (AI Chat | Document/Prototype | Comments) */}
            {/* ========================================== */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

                {/* --- Column 1: AI Assistant Sidebar --- */}
                {/* --- Column 1: AI Assistant Sidebar --- */}
                <AiAssistantSidebar
                    ref={sidebarRef}
                    currentRole={currentRole}
                    onTriggerAiReview={handleAiAnalysisComplete}
                />

                {/* --- Column 2: Document/Prototype View --- */}
                <div className="flex-1 relative overflow-hidden min-w-0 bg-[#2C2C2C] rounded-xl">
                    <div className="h-full w-full overflow-hidden" ref={scrollContainerRef}>
                        <MockSplitView
                            activeCommentId={activeId}
                            activeUiId={comments.find(c => c.id === activeId)?.anchor?.uiRef || null}
                            comments={comments}
                            onTextSelect={handleTextSelect}
                            isThinking={false}
                            isReviewing={false}
                            activeSection={null}
                            onSelectElement={handleElementClick}
                            isLegacyMode={false}
                            isFallbackActive={false}
                        />
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
                                    className="bg-zinc-800 shadow-xl text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 flex items-center gap-2"
                                >
                                    💬 Add Comment
                                </button>
                            ) : (
                                <div className="bg-zinc-800 shadow-2xl rounded-lg p-3 w-72 flex flex-col gap-2">
                                    <div className="text-xs text-zinc-400 border-l-2 border-yellow-500 pl-2 mb-1 truncate">Target: "{selectedText}"</div>
                                    <textarea
                                        autoFocus
                                        className="bg-black/50 border border-zinc-700 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                                        rows={3}
                                        placeholder="Type your comment..."
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        // Submit hotkey
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

                {/* --- Column 3: Comment Sidebar --- */}
                <div className="w-[340px] bg-zinc-900 flex flex-col rounded-xl overflow-hidden">
                    <div className="h-14 flex items-center px-4 bg-zinc-900/50">
                        <span className="font-medium">评论 ({comments.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">


                        {comments.map(c => (
                            <CommentCard
                                key={c.id}
                                comment={c}
                                isActive={activeId === c.id}
                                onClick={handleCommentClick}
                                onReply={handleReply}
                                onDelete={handleDeleteComment}
                            />
                        ))}
                    </div>
                </div>

            </div>
        </div >
    );
}
