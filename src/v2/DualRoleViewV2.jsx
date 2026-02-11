import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Modal from '../components/Modal';
import ProgressiveLayout from '../components/ProgressiveLayout';
import FeedbackSummaryCard from '../components/FeedbackSummaryCard';
import DiffPreviewPanel from '../components/DiffPreviewPanel';
import VersionSelector from '../components/VersionSelector';
import { IconSend } from '../svg-icons';
import { DOCUMENT_CONTENT } from '../data/documentModel';
import { sendMessageToKimi, sendSimpleChat, extractJsonFromText } from '../services/kimiService';
import { eventBus, EVENTS } from '../utils/eventBus';

import { useChatStore } from '../store/chatStore';
import axios from 'axios';



// ==========================================
// Helper: 判断评论是否来自甲方真人（排除 AI 和乙方）
// ==========================================
function isHumanClientComment(comment) {
    if (comment.user === "Vendor Agent" || comment.user === "乙方 AI 智能回复") return false;
    if (comment.type === "AI_CLIENT") return false;
    if (comment.user === "AI 审查员") return false;
    if (comment.user?.includes("AI Assistant")) return false;
    if (comment.user === "甲方虚拟代理") return false;
    if (comment.user === "Vendor Team" || comment.user === "乙方团队") return false;
    if (comment.user?.startsWith("Me (Vendor") || comment.user?.includes("乙方")) return false;
    return true;
}

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



// LocalStorage keys for persistence
const VERSIONS_STORAGE_KEY = 'dualrole_v4_versions_v2';

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
// Helper: Load versions from localStorage or create initial version
// Each version contains its own comments array (version-scoped comments)
const loadVersionsFromStorage = () => {
    try {
        const stored = localStorage.getItem(VERSIONS_STORAGE_KEY);
        if (stored !== null) {
            let parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                parsed = parsed.map((v, i) => ({
                    ...v,
                    comments: Array.isArray(v.comments) ? v.comments : [],
                    // 补充 visibility：第一个版本默认 public，其余根据是否已有该字段决定
                    visibility: v.visibility || (i === 0 ? 'public' : 'public'),
                }));
                // Ensure SEED comments in first version
                const firstVersion = parsed[0];
                SEED_COMMENTS_SANDBOX.forEach(seed => {
                    const existingIdx = firstVersion.comments.findIndex(p => p.id === seed.id);
                    if (existingIdx !== -1) {
                        firstVersion.comments[existingIdx] = {
                            ...firstVersion.comments[existingIdx],
                            anchor: seed.anchor,
                        };
                    } else {
                        firstVersion.comments.unshift(seed);
                    }
                });
                return parsed;
            }
        }
    } catch (e) {
        console.warn('[DualRole] Failed to load versions from localStorage:', e);
    }
    return [{
        id: 'v1.0',
        label: '原始文档',
        content: DOCUMENT_CONTENT.map(d => ({ ...d })),
        comments: [...SEED_COMMENTS_SANDBOX],
        createdAt: new Date().toISOString(),
        patchCount: 0,
        patchSummary: null,
        visibility: 'public', // 初始版本对所有人可见
    }];
};

export default function DualRoleViewV2() {
    // --- State ---
    const [activeId, setActiveId] = useState(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // --- 文档版本管理（每个版本包含独立的 comments 数组）---
    const [documentVersions, setDocumentVersions] = useState(loadVersionsFromStorage);
    const [activeVersionIndex, setActiveVersionIndex] = useState(0);

    // Import store for Agent state
    const {
        agentEnabled,
        setAgentEnabled,
        isAgentTyping,
        setIsAgentTyping
    } = useChatStore();

    // 当前文档内容 = 当前激活版本的快照
    const documentContent = React.useMemo(
        () => documentVersions[activeVersionIndex]?.content || [],
        [documentVersions, activeVersionIndex]
    );

    // 当前版本的评论（只读派生，版本隔离）
    const comments = React.useMemo(
        () => documentVersions[activeVersionIndex]?.comments || [],
        [documentVersions, activeVersionIndex]
    );

    // Helper: 更新当前版本的评论（替代所有 setComments 调用）
    const updateCurrentVersionComments = useCallback((updater) => {
        setDocumentVersions(prev => prev.map((v, i) => {
            if (i !== activeVersionIndex) return v;
            const newComments = typeof updater === 'function'
                ? updater(v.comments || [])
                : updater;
            return { ...v, comments: newComments };
        }));
    }, [activeVersionIndex]);

    // --- 评论总结相关状态 ---
    const [feedbackSummary, setFeedbackSummary] = useState(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const autoSummaryTriggeredRef = useRef(false);

    // --- 应用调整相关状态 ---
    const [pendingPatches, setPendingPatches] = useState(null);
    const [isGeneratingPatches, setIsGeneratingPatches] = useState(false);
    const [showDiffPreview, setShowDiffPreview] = useState(false);

    // --- Dynamic Agent Config State ---
    const [vendorConfig, setVendorConfig] = useState({
        strategy: DEFAULT_STRATEGY,
        style: DEFAULT_STYLE
    });

    // Sync Config from Server/EventBus
    useEffect(() => {
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

    // Persist versions to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(documentVersions));
        } catch (e) {
            console.warn('[DualRole] Failed to save versions to localStorage:', e);
        }
    }, [documentVersions]);

    // --- 甲方评论总结 ---
    const handleSummarizeComments = useCallback(async () => {
        const clientComments = comments.filter(isHumanClientComment);
        if (clientComments.length === 0) return;

        setIsSummarizing(true);
        setFeedbackSummary(null);

        try {
            const commentsText = clientComments.map((c, i) => {
                const quote = c.anchor?.quote ? `引用: "${c.anchor.quote}"` : '(无引用)';
                return `评论${i + 1} [ID: ${c.id}]\n  评论人: ${c.user}\n  ${quote}\n  内容: "${c.content}"`;
            }).join('\n\n');

            const docText = documentContent.map(b => `[${b.id}] ${b.text}`).join('\n');

            const systemPrompt = `你是一个专业的项目协调员。请对以下甲方客户的评论进行分析和总结。

当前文档内容:
${docText}

输出要求 - 严格返回 JSON（不要包含 markdown 代码块标记），格式如下:
{
  "total_count": <评论总数>,
  "priority": "high" | "medium" | "low",
  "themes": [
    {
      "theme": "<主题名称>",
      "count": <相关评论数>,
      "summary": "<该主题的核心内容总结>",
      "original_comment_ids": ["<评论ID>"],
      "severity": "high" | "medium" | "low"
    }
  ],
  "action_items": ["<具体建议行动1>", "<具体建议行动2>"]
}

注意:
1. themes 要做归类合并，相似评论合到一个主题
2. action_items 要具体可执行
3. priority 根据评论的紧迫程度和影响范围综合判断
4. 所有内容用中文`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: `以下是甲方客户的评论（共 ${clientComments.length} 条）:\n\n${commentsText}` }
            ];

            const rawResponse = await sendSimpleChat(messages);
            let parsed = extractJsonFromText(rawResponse);
            if (!parsed) {
                parsed = {
                    total_count: clientComments.length,
                    priority: 'medium',
                    themes: [{ theme: '综合反馈', count: clientComments.length, summary: rawResponse.substring(0, 200), original_comment_ids: clientComments.map(c => c.id), severity: 'medium' }],
                    action_items: ['请查看原始评论获取详细信息']
                };
            }

            setFeedbackSummary(parsed);
        } catch (err) {
            console.error('[DualRole] Summarization failed:', err);
        } finally {
            setIsSummarizing(false);
        }
    }, [comments, documentContent]);

    // --- 应用调整 - AI 生成文档修改 patches ---
    const handleApplyAdjustments = useCallback(async (summary) => {
        setIsGeneratingPatches(true);
        setShowDiffPreview(true);
        setPendingPatches(null);

        try {
            const docBlocks = documentContent.map(b => `[${b.id}] (label: ${b.label}) 内容: "${b.text}"`).join('\n');
            const themesText = summary.themes?.map(t => `- ${t.theme} (${t.count}条, ${t.severity}): ${t.summary}`).join('\n') || '无';
            const actionsText = summary.action_items?.map((a, i) => `${i + 1}. ${a}`).join('\n') || '无';

            const systemPrompt = `你是一个专业的文档编辑助手。根据甲方客户的反馈总结，生成对文档的具体修改建议。

当前文档内容（每行格式为 [block_id] (label) 内容）:
${docBlocks}

甲方反馈总结:
- 整体优先级: ${summary.priority}
- 主题分类:
${themesText}
- 建议行动:
${actionsText}

输出要求 - 严格返回 JSON（不要包含 markdown 代码块标记），格式如下:
{
  "patches": [
    {
      "block_id": "<对应的 block id>",
      "action": "modify",
      "original_text": "<当前的完整文本内容>",
      "new_text": "<修改后的完整文本内容>",
      "reason": "<修改原因>"
    }
  ]
}

注意: block_id 必须是文档中实际存在的 id，original_text 必须与当前文档内容完全一致，所有输出用中文`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: `请根据以上甲方反馈，生成文档的具体修改 patches。` }
            ];

            const rawResponse = await sendSimpleChat(messages);
            const parsed = extractJsonFromText(rawResponse);
            if (!parsed) {
                setPendingPatches([]);
                return;
            }

            const patches = parsed.patches || [];
            const validPatches = patches.filter(p => documentContent.some(d => d.id === p.block_id));
            setPendingPatches(validPatches);
        } catch (err) {
            console.error('[DualRole] Patch generation failed:', err);
            setPendingPatches([]);
        } finally {
            setIsGeneratingPatches(false);
        }
    }, [documentContent]);

    // --- 一键应用 patches → 创建新文档版本 ---
    const applyPatches = useCallback((patches) => {
        const currentContent = documentVersions[activeVersionIndex].content.map(d => ({ ...d }));
        let appliedCount = 0;

        patches.forEach(patch => {
            const idx = currentContent.findIndex(d => d.id === patch.block_id);
            if (idx === -1) return;
            if (patch.action === 'modify') {
                currentContent[idx] = { ...currentContent[idx], text: patch.new_text };
                appliedCount++;
            }
        });

        const newVersionNumber = documentVersions.length + 1;
        const newVersion = {
            id: `v${newVersionNumber}.0`,
            label: `反馈调整（${appliedCount} 处修改）`,
            content: currentContent,
            comments: [],
            createdAt: new Date().toISOString(),
            patchCount: appliedCount,
            patchSummary: patches.map(p => p.reason).join('；'),
            visibility: 'vendor_only', // 新增：默认仅乙方可见
        };

        setDocumentVersions(prev => [...prev, newVersion]);
        setActiveVersionIndex(newVersionNumber - 1);
        setShowDiffPreview(false);
        setPendingPatches(null);
        setFeedbackSummary(null);
        autoSummaryTriggeredRef.current = false;

        console.log(`[DualRole] Created new version ${newVersion.id}: "${newVersion.label}" (visibility: vendor_only)`);
    }, [documentVersions, activeVersionIndex]);

    // --- 自动触发 - 甲方真人评论 >= 5 条时自动生成总结 ---
    useEffect(() => {
        const clientComments = comments.filter(isHumanClientComment);
        if (
            clientComments.length >= 5 &&
            !autoSummaryTriggeredRef.current &&
            !feedbackSummary &&
            !isSummarizing
        ) {
            autoSummaryTriggeredRef.current = true;
            handleSummarizeComments();
        }
    }, [comments, feedbackSummary, isSummarizing, handleSummarizeComments]);

    // DUAL ROLE STATE
    const [currentRole, setCurrentRole] = useState('PARTY_A'); // 'PARTY_A' | 'PARTY_B'

    // AI States (Party A)

    // Agent States (Party B)
    // Agent States (Party B) - Now managed by chatStore
    // const [agentEnabled, setAgentEnabled] = useState(false);
    // const [isAgentTyping, setIsAgentTyping] = useState(false);

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

                // Extract PRD Context (from current version)
                const documentText = documentContent.map(b => b.text).join('\n\n');

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

                updateCurrentVersionComments(prev => prev.map(c =>
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

        updateCurrentVersionComments(prev => [...prev, newComment]);

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

    // 5. Delete Comment
    const handleDeleteComment = (id) => {
        updateCurrentVersionComments(prev => prev.filter(c => c.id !== id));
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

        updateCurrentVersionComments(prev => prev.map(c =>
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

        updateCurrentVersionComments(prev => [...prev, ...formattedComments]);
    };

    // --- Helper for Anchor Linking (use version-scoped documentContent) ---
    const findBlockIdForQuote = (quote) => {
        if (!quote || !quote.trim()) return documentContent[0]?.id || "block-doc-title";
        const searchQuote = quote.trim();
        for (const block of documentContent) {
            if (block.text && block.text.includes(searchQuote)) return block.id;
        }
        const words = searchQuote.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            for (const block of documentContent) {
                if (!block.text) continue;
                const matchCount = words.filter(word => block.text.includes(word)).length;
                if (matchCount >= Math.ceil(words.length * 0.5)) return block.id;
            }
        }
        return documentContent[0]?.id || "block-doc-title";
    };

    // CommentCard 渲染函数（传递给 ProgressiveLayout）
    const renderComment = (c) => (
        <CommentCard
            key={c.id}
            comment={c}
            isActive={activeId === c.id}
            onClick={handleCommentClick}
            onReply={handleReply}
            onDelete={handleDeleteComment}
        />
    );

    // --- 发布当前版本（将 visibility 设置为 public）---
    const handlePublishCurrentVersion = useCallback(() => {
        setDocumentVersions(prev => prev.map((v, i) => {
            if (i !== activeVersionIndex) return v;
            return { ...v, visibility: 'public' };
        }));
        console.log(`[DualRole] Published version ${activeVersionIndex} to public`);
    }, [activeVersionIndex]);

    return (
        <>
            {/* Modal for Config (Popup) */}
            <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="系统配置">
                <Suspense fallback={<div className="p-4">Loading Config...</div>}>
                    <AppConfig isEmbedded={true} />
                </Suspense>
            </Modal>

            {/* 渐进式布局容器 */}
            <ProgressiveLayout
                comments={comments}
                activeId={activeId}
                currentRole={currentRole}
                agentEnabled={agentEnabled}
                vendorConfig={vendorConfig}
                isAgentTyping={isAgentTyping}

                onCommentClick={handleCommentClick}
                onElementClick={handleElementClick}
                onReply={handleReply}
                onDeleteComment={handleDeleteComment}
                onTextSelect={handleTextSelect}
                onSubmit={handleSubmit}

                sidebarRef={sidebarRef}
                scrollContainerRef={scrollContainerRef}

                toolbarPosition={toolbarPosition}
                isInputOpen={isInputOpen}
                inputValue={inputValue}
                selectedText={selectedText}

                setInputValue={setInputValue}
                setIsInputOpen={setIsInputOpen}
                handleOpenInput={handleOpenInput}
                handleAiReviewTrigger={handleAiReviewTrigger}
                handleAiAnalysisComplete={handleAiAnalysisComplete}

                setIsConfigOpen={setIsConfigOpen}

                setAgentEnabled={setAgentEnabled}
                setCurrentRole={setCurrentRole}
                setIsAgentTyping={setIsAgentTyping}

                renderComment={renderComment}

                // --- V4.0: 版本管理 ---
                documentVersions={documentVersions}
                activeVersionIndex={activeVersionIndex}
                onVersionSwitch={(newIndex) => {
                    // 如果是甲方，需要将过滤后的索引映射回原始索引
                    if (currentRole === 'PARTY_A') {
                        const visibleVersions = documentVersions.filter(v =>
                            v.visibility === 'public' || !v.visibility
                        );
                        if (newIndex >= 0 && newIndex < visibleVersions.length) {
                            const targetVersion = visibleVersions[newIndex];
                            const actualIndex = documentVersions.findIndex(v => v.id === targetVersion.id);
                            if (actualIndex !== -1) {
                                setActiveVersionIndex(actualIndex);
                                setActiveId(null);
                                autoSummaryTriggeredRef.current = false;
                                setFeedbackSummary(null);
                            }
                        }
                    } else {
                        // 乙方直接使用索引
                        setActiveVersionIndex(newIndex);
                        setActiveId(null);
                        autoSummaryTriggeredRef.current = false;
                        setFeedbackSummary(null);
                    }
                }}
                onPublishCurrentVersion={handlePublishCurrentVersion}

                // --- V4.0: 评论总结 ---
                feedbackSummary={feedbackSummary}
                isSummarizing={isSummarizing}
                onSummarizeComments={handleSummarizeComments}
                onApplyAdjustments={handleApplyAdjustments}
                onDismissSummary={() => setFeedbackSummary(null)}
                hasHumanClientComments={comments.filter(isHumanClientComment).length > 0}
            />

            {/* Diff Preview Panel (Modal) */}
            {showDiffPreview && (
                <DiffPreviewPanel
                    patches={pendingPatches}
                    isLoading={isGeneratingPatches}
                    onConfirm={(selectedPatches) => {
                        console.log('[DualRole] Applying', selectedPatches.length, 'patches');
                        applyPatches(selectedPatches);
                    }}
                    onCancel={() => {
                        setShowDiffPreview(false);
                        setPendingPatches(null);
                    }}
                />
            )}
        </>
    );
}
