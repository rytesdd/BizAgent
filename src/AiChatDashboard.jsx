import { useState, useEffect, useRef, useCallback, Fragment, lazy, Suspense, useMemo, memo } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Bubble, Sender } from '@ant-design/x';
import { IconAI, IconMenu, IconSend, IconAttachment, IconEmoji, IconPlus, IconTrash, IconChevronDown, IconCheck } from './svg-icons';
import Drawer from './components/Drawer';
import { eventBus, EVENTS } from './utils/eventBus';
import MockSplitView from './MockSplitView';
import ThinkingAccordion from './components/ThinkingAccordion'; // Restore Import

// 懒加载配置面板，避免与 App 的循环依赖导致 Vite HMR 500
const AppConfig = lazy(() => import('./App').then(m => ({ default: m.default })));

/**
 * 评论项（Comment Item）数据结构约定（Mock / 类型）
 * @typedef {Object} CommentItem
 * @property {string} id - 评论 ID
 * @property {string} content - 评论内容
 * @property {string} [quote] - 该评论针对的原文片段（与 quoted_text 二选一或并存，优先使用）
 * @property {string} [quoted_text] - 同上，后端常用字段
 * @property {string} [risk_level]
 * @property {string} [author_type]
 * @property {string} [created_at]
 * @property {string} [reply_content]
 * @property {string} [reply_author_type]
 */

// 常量
const AUTHOR_TYPES = {
  AI_CLIENT: "AI_CLIENT",
  HUMAN_CLIENT: "HUMAN_CLIENT",
  AI_VENDOR: "AI_VENDOR",
  HUMAN_VENDOR: "HUMAN_VENDOR",
  SYSTEM: "SYSTEM",
};

// 轮询间隔（毫秒）- 5s 降低请求堆积与主线程压力
const POLL_INTERVAL = 5000;

// 自动回复轮询间隔（毫秒）- 每5秒检查一次未回复评论
const AUTO_REPLY_POLL_INTERVAL = 5000;

// API 请求超时（毫秒）- 后端未启动时快速失败，避免挂起导致页面假死
const API_TIMEOUT = 15000;

// 预览区文本达到此字数后，「AI 审查文档」按钮才可点击
const MIN_PRD_LENGTH_FOR_REVIEW = 50;

// 统一配色（灰色系）
const UNIFIED_COLORS = {
  bg: 'bg-[#3f3f46]',
  bgLight: 'bg-[#27272a]',
  bgLighter: 'bg-[#27272a]/50',
  text: 'text-[#e4e4e7]',
  textMuted: 'text-[#a1a1aa]',
  border: 'border-[#3f3f46]',
};

// O(N*M) 优化为 O(N + M*logM) 或更优，避免大型文档卡死
function buildPrdSegments(prdText, comments) {
  if (!prdText) return [{ type: 'normal', text: '' }];
  if (!comments || comments.length === 0) return [{ type: 'normal', text: prdText }];

  // 1. 收集所有命中区间
  let validComments = comments.filter(c => {
    const qt = (c.quote ?? c.quoted_text ?? '').trim();
    return qt && qt.length > 0;
  });

  if (validComments.length === 0) return [{ type: 'normal', text: prdText }];

  const ranges = [];

  // 优化：避免重复 indexOf，但对于大量重复短语仍可能有性能问题。
  // 考虑到实际场景，评论数量通常有限 (<1000)，主要瓶颈是 prdText 长度。
  // 简单的 indexOf 循环通常足够快，除非 worst case。
  // 之前的 while 循环逻辑有重叠判断开销 O(K^2)。

  for (const comment of validComments) {
    const qt = (comment.quote ?? comment.quoted_text ?? '').trim();
    if (!qt) continue;

    let start = prdText.indexOf(qt);
    let count = 0;
    while (start !== -1 && count < 100) { // 限制单条评论匹配上限，防止极端情况
      ranges.push({ start, end: start + qt.length, commentId: comment.id });
      start = prdText.indexOf(qt, start + 1);
      count++;
    }
  }

  if (ranges.length === 0) return [{ type: 'normal', text: prdText }];

  // 2. 排序与合并区间
  ranges.sort((a, b) => a.start - b.start);

  const segments = [];
  let currentPos = 0;

  // 简单的贪心策略：遇到重叠，优先保留较早开始的（或由 sort 决定），跳过重叠部分
  // 更完美的做法是处理嵌套，但高亮通常不支持嵌套，直接切分即可

  for (const range of ranges) {
    if (range.start < currentPos) continue; // 跳过已处理的（重叠）部分

    // 添加中间的普通文本
    if (range.start > currentPos) {
      segments.push({ type: 'normal', text: prdText.slice(currentPos, range.start) });
    }

    // 添加高亮文本
    segments.push({
      type: 'highlight',
      text: prdText.slice(range.start, range.end),
      commentId: range.commentId
    });

    currentPos = range.end;
  }

  // 添加剩余文本
  if (currentPos < prdText.length) {
    segments.push({ type: 'normal', text: prdText.slice(currentPos) });
  }

  return segments;
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 仅当 markdown 字符串变化时重渲染，降低 rehype-raw 的渲染频率 */
const MemoizedPrdMarkdown = memo(function MemoizedPrdMarkdown({ markdown }) {
  // 使用 useMemo 进一步确保只有 markdown 真的变了才解析
  // 但 ReactMarkdown 本身也会做 diff？不，rehypeRaw 比较重
  return <ReactMarkdown rehypePlugins={[rehypeRaw]}>{markdown}</ReactMarkdown>;
}, (prev, next) => prev.markdown === next.markdown);

/** 将 prdText 与 comments 结合，生成带高亮锚点的 Markdown 字符串 */
// 移出组件外，纯函数
function buildPrdMarkdownWithHighlights(prdText, comments) {
  // 如果没有评论，直接返回原文本，省去切分
  if (!comments || comments.length === 0) return prdText || '';

  const segments = buildPrdSegments(prdText, comments);
  // 使用数组 join 比字符串拼接稍快
  return segments.map(seg => {
    if (seg.type === 'normal') return seg.text;
    return `<span id="comment-${seg.commentId}" class="highlight-target">${escapeHtml(seg.text)}</span>`;
  }).join('');
}

// 视角配置
const VIEW_ROLES = {
  client: {
    name: '甲方',
    label: '甲方视角',
    emoji: '📋',
    description: '需求方 / 客户',
    chatTitle: '甲方 AI 助手',
    chatPlaceholder: '输入消息...',
    color: UNIFIED_COLORS,
  },
  vendor: {
    name: '乙方',
    label: '乙方视角',
    emoji: '💼',
    description: '供应商 / 开发方',
    chatTitle: '乙方 AI 助手',
    chatPlaceholder: '输入消息...',
    color: UNIFIED_COLORS,
  },
};

export default function AiChatDashboard() {
  // ============================================
  // SEED_DATA - 种子数据（用于智能过滤机制）
  // ============================================
  const SEED_DATA = [
    {
      id: "init_001",
      user: "甲方 AI",
      content: "SAAS 团队版的价格字体太小，建议放大以提升可读性。",
      targetId: "ui-price-card",
      anchor: { blockId: "block-card-team-price", quote: "25积分" },
      type: "client-ai",
      status: "active",
      created_at: 1769941481000
    },
    {
      id: "init_002",
      user: "甲方 AI",
      content: "免费缓冲期的具体起止日期需要加粗，避免用户产生歧义。",
      anchor: { blockId: "block-section-3-item-1", quote: "2026 年 1 月 26 日" },
      type: "client-ai",
      status: "active",
      created_at: 1769941482000
    },
    {
      id: "init_003",
      user: "甲方 AI",
      content: "性能优化部分的具体指标（0分/次）描述不够直观。",
      anchor: { blockId: "block-rule-perf-val", quote: "0分/次" },
      type: "client-ai",
      status: "active",
      created_at: 1769941483000
    }

  ];

  // DeepSeek-Style 思考链数据
  const MOCK_THOUGHTS = [
    "正在初始化多模态视觉扫描模型...",
    "已识别关键 UI 区域：[定价卡片]、[功能列表]、[底部条款]...",
    "正在进行 OCR 文字提取与语义分析...",
    "深度检查：检测到“25积分”与背景对比度略低 (WCAG 标准)...",
    "逻辑校验：正在比对“免费缓冲期”日期与 SLA 协议数据库...",
    "正在生成结构化审查建议..."
  ];

  // ============================================
  // 状态管理
  // ============================================
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrdGenerating, setIsPrdGenerating] = useState(false);  // PRD 生成状态
  const [showMockView, setShowMockView] = useState(false); // Demo 演示模式：Mock 分屏视图
  const [inputValue, setInputValue] = useState('');
  const [isUnloading, setIsUnloading] = useState(false);

  // 甲乙方独立的消息状态
  const [clientMessages, setClientMessages] = useState([]);
  const [vendorMessages, setVendorMessages] = useState([]);

  const [comments, setComments] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [prdText, setPrdText] = useState('');
  const [prdFileType, setPrdFileType] = useState(null);   // 'PDF' | 'TXT' | 'MD' | null，用于预览区展示 PDF
  const [prdFileUrl, setPrdFileUrl] = useState(null);    // PDF 时用于 iframe src
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isReformatting, setIsReformatting] = useState(false);  // 用 AI 重新整理中
  const [isReviewing, setIsReviewing] = useState(false);        // 甲方 AI 审查文档中
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(true);
  const [activeCommentId, setActiveCommentId] = useState(null);
  // Agent 自动回复开关 - 从 localStorage 恢复状态
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState(() => {
    return localStorage.getItem('bizagent_auto_reply_enabled') === 'true';
  });
  const [isAutoReplying, setIsAutoReplying] = useState(false);
  // 思维链状态 - 单行文本显示
  const [thoughtChainText, setThoughtChainText] = useState('');
  const [isThoughtChainVisible, setIsThoughtChainVisible] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  // 当前正在回复的评论 ID（避免重复触发）
  const autoReplyingCommentIdRef = useRef(null);

  // 全局视角切换
  const [viewRole, setViewRole] = useState('client');
  const [replyInputs, setReplyInputs] = useState({});

  // 会话管理状态
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const [clientSessions, setClientSessions] = useState([]);
  const [vendorSessions, setVendorSessions] = useState([]);
  const [currentClientSessionId, setCurrentClientSessionId] = useState(null);
  const [currentVendorSessionId, setCurrentVendorSessionId] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatScrollStateRef = useRef({ scrollTop: 0, wasAtBottom: true });
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionDropdownRef = useRef(null);
  const abortControllerRef = useRef(null);
  const docViewerScrollRef = useRef(null);
  const commentTextareaRef = useRef(null);

  const commentListRef = useRef(null);
  const localReviewResultRef = useRef(null); // Persistence for local thinking result

  // 手动选择 UI 目标状态
  const [selectedUiTarget, setSelectedUiTarget] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null); // New: Capture Block ID

  // Debug: 混合双轨调试机制状态
  const [isLegacyMode, setIsLegacyMode] = useState(false); // Default to false for Strict New Mode
  const [isFallbackActive, setIsFallbackActive] = useState(false); // 是否使用了 Legacy Fallback

  // ============================================
  // 初始化和轮询 (Moved up to avoid ReferenceError)
  // ============================================

  // 获取 AI 状态
  const fetchAiStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/ai/status', { timeout: API_TIMEOUT });
      if (response.data.success) {
        setAiStatus(response.data.data);
      }
    } catch (error) {
      console.error('获取 AI 状态失败:', error);
    }
  }, []);

  // 释放本地模型
  const handleUnloadModel = async () => {
    if (isUnloading || isGenerating) return;

    setIsUnloading(true);
    try {
      const response = await axios.post('/api/ai/unload');
      if (response.data.success) {
        addSystemMessage(`✅ ${response.data.data.message}`);
      } else {
        addSystemMessage(`⚠️ ${response.data.error || '释放失败'}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      addSystemMessage(`❌ 模型释放失败: ${errorMsg}`);
    } finally {
      setIsUnloading(false);
    }
  };

  // 获取数据（支持视角分离和会话管理）
  // skipComments: PRD 生成完成后刷新时传 true，不覆盖评论（保持 []）
  const fetchData = useCallback(async (skipComments = false) => {
    const reqOpts = { timeout: API_TIMEOUT };
    try {
      const [clientMsgRes, vendorMsgRes, commentsRes, dbRes, clientSessionsRes, vendorSessionsRes] = await Promise.all([
        axios.get('/api/chat/messages', { params: { view_role: 'client' }, ...reqOpts }),
        axios.get('/api/chat/messages', { params: { view_role: 'vendor' }, ...reqOpts }),
        axios.get('/api/comments', reqOpts),
        axios.get('/api/debug/db', reqOpts),
        axios.get('/api/chat/sessions', { params: { view_role: 'client' }, ...reqOpts }),
        axios.get('/api/chat/sessions', { params: { view_role: 'vendor' }, ...reqOpts }),
      ]);

      if (clientMsgRes.data.success) {
        let msgs = clientMsgRes.data.data.messages || [];
        // Merge persistent local result if exists (Demo Mode persistence)
        if (localReviewResultRef.current) {
          // Avoid duplicates if backend somehow has it (unlikely for local JSX)
          if (!msgs.some(m => m.id === localReviewResultRef.current.id)) {
            msgs = [...msgs, localReviewResultRef.current];
          }
        }
        setClientMessages(msgs);
      }
      if (vendorMsgRes.data.success) {
        setVendorMessages(vendorMsgRes.data.data.messages || []);
      }
      if (commentsRes.data.success && !skipComments) {
        const dbData = commentsRes.data.data.comments || [];

        // --- CORE LOGIC: RELAXED SMART FILTER + SEED DATA RESTORATION ---

        // 1. Force Merge SEED_DATA if not present in DB (Hybrid approach for Demo reliability)
        // Check if DB has our seed data by ID
        const finalDbData = [...dbData];
        SEED_DATA.forEach(seed => {
          if (!finalDbData.some(d => d.id === seed.id)) {
            finalDbData.push(seed);
          }
        });

        // 2. Filter valid comments
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const validNewData = finalDbData.filter(c => {
          // A. Keep if it has a targetId (Old Mode)
          if (c.targetId || c.target_id) return true;

          // B. Keep if it has an ANCHOR (New Feishu Mode) - CRITICAL FIX
          if (c.anchor && c.anchor.blockId && c.anchor.quote) return true;

          // C. Keep if it was created RECENTLY (User manual comments)
          if (c.created_at) {
            const createdTime = typeof c.created_at === 'string'
              ? new Date(c.created_at).getTime()
              : c.created_at;
            if (createdTime > oneDayAgo) return true;
          }
          return false;
        });

        const finalComments = validNewData.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        console.log(
          `[🔄 Data Sync] Loaded ${finalComments.length} comments (DB + Seed).`
        );

        setComments(prev => {
          if (prev.length === finalComments.length && JSON.stringify(prev) === JSON.stringify(finalComments)) {
            return prev;
          }
          return finalComments;
        });
      }
      if (dbRes.data.success) {
        const ctx = dbRes.data.data.project_context;
        // PRD 文本也做个简单防抖
        const newText = ctx?.prd_text || '';
        setPrdText(prev => prev === newText ? prev : newText);

        setPrdFileType(ctx?.file_type || null);
        setPrdFileUrl(ctx?.prd_file_path
          ? `/api/file/serve?path=${encodeURIComponent(ctx.prd_file_path)}`
          : null);
      }
      // 会话列表
      if (clientSessionsRes.data.success) {
        setClientSessions(clientSessionsRes.data.data.sessions || []);
        setCurrentClientSessionId(clientSessionsRes.data.data.current_session_id);
      }
      if (vendorSessionsRes.data.success) {
        setVendorSessions(vendorSessionsRes.data.data.sessions || []);
        setCurrentVendorSessionId(vendorSessionsRes.data.data.current_session_id);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    }
  }, []);

  // 文本选中评论：选中态与浮动条/输入框
  const [selectedText, setSelectedText] = useState('');
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  // 输入框以 fixed 定位时的视口坐标（仅在 showCommentInput 时有效，用于边界安全）
  const [commentInputFixedPosition, setCommentInputFixedPosition] = useState(null);

  const COMMENT_BOX_WIDTH = 256;
  const COMMENT_BOX_HEIGHT_EST = 200;
  const COMMENT_MARGIN = 16;
  const COMMENT_GAP = 8;
  const TOOLBAR_WIDTH = 100;

  // 点击评论时滚动 PRD 到对应被评论原文位置（锚点 id="comment-{id}"），并设为激活态
  const scrollToCommentInPrd = useCallback((commentId) => {
    setActiveCommentId(commentId);
    const el = document.getElementById(`comment-${commentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // 文档区 Text Select Handler (New logic from MockSplitView)
  const handleTextSelect = useCallback(({ blockId, text, rect }) => {
    if (!text) return;

    setSelectedText(text);
    setSelectedBlockId(blockId);
    setSelectedUiTarget(null); // Clear UI selection if text is selected

    const container = docViewerScrollRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    // Position logic similar to before but using the passed rect
    const leftVp = Math.min(Math.max(rect.left, COMMENT_MARGIN), window.innerWidth - TOOLBAR_WIDTH - COMMENT_MARGIN);
    const left = leftVp - containerRect.left + container.scrollLeft;
    const top = rect.bottom - containerRect.top + container.scrollTop + COMMENT_GAP;

    setToolbarPosition({ top, left });
    setShowCommentInput(false);
  }, []);

  // 处理 UI 元素选中（手动高亮）
  const handleUiSelect = useCallback((id, name) => {
    console.log('[Dashboard] Selected UI Target:', id, name);
    setSelectedUiTarget({ id, name });
    addSystemMessage(`📍 已选中 UI 区域: ${name} (发送评论将自动绑定)`);
  }, []);

  // 打开评论输入框时自动聚焦
  useEffect(() => {
    if (showCommentInput) {
      setCommentInputValue('');
      requestAnimationFrame(() => commentTextareaRef.current?.focus());
    }
  }, [showCommentInput]);

  // 发送选中评论：持久化到后端，成功后刷新数据
  const submitSelectionComment = useCallback(async () => {
    console.log('[评论提交] 函数被调用！');
    console.log('[评论提交] selectedText =', selectedText, '| length =', selectedText?.length);
    console.log('[评论提交] commentInputValue =', commentInputValue);

    const content = (commentInputValue ?? '').trim();
    if (!selectedText) {
      console.warn('[评论提交] selectedText 为空，取消提交');
      return;
    }

    // Step A: 立即打开评论面板
    setIsCommentPanelOpen(true);
    const authorType = viewRole === 'client' ? AUTHOR_TYPES.HUMAN_CLIENT : AUTHOR_TYPES.HUMAN_VENDOR;

    try {
      console.log('[评论提交] 正在发送请求到 /api/comments...');
      console.log('[评论提交] selectedUiTarget =', selectedUiTarget);
      const response = await axios.post('/api/comments', {
        content: content || '(无内容)',
        quote: selectedText,
        anchor: { blockId: selectedBlockId, quote: selectedText }, // New Schema
        author_type: authorType,
        ...(selectedUiTarget ? { target_id: selectedUiTarget.id } : {}),
      });

      console.log('[评论提交] 服务器响应:', response.data);

      if (!response.data?.success) {
        console.error('[评论提交] 服务器返回失败');
        return;
      }

      console.log('[评论提交] 评论创建成功，开始刷新数据...');

      // Step B: 先关闭输入框并清除锁定的目标
      setShowCommentInput(false);
      setCommentInputFixedPosition(null);
      setSelectedText('');
      setToolbarPosition(null);
      setCommentInputValue('');
      setSelectedUiTarget(null); // 清除已锁定的目标
      window.getSelection()?.removeAllRanges();

      // Step C: 调用 fetchData() 从服务器同步最新数据
      await fetchData();

      console.log('[评论提交] 完成！');
    } catch (err) {
      console.error('[评论提交] 请求失败:', err);
    }
  }, [selectedText, commentInputValue, viewRole, fetchData, selectedUiTarget]);

  // 点击遮罩或取消按钮：关闭评论输入并清除选区
  const handleCommentCancel = useCallback(() => {
    setShowCommentInput(false);
    setCommentInputFixedPosition(null);
    setSelectedText('');
    setToolbarPosition(null);
    setCommentInputValue('');
    window.getSelection()?.removeAllRanges();
  }, []);

  // 打开评论输入框：计算 fixed 定位（8px 下方，水平 clamp；下方空间不足时改为上方）
  const openCommentInput = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.left, COMMENT_MARGIN),
      window.innerWidth - COMMENT_BOX_WIDTH - COMMENT_MARGIN
    );
    let top = rect.bottom + COMMENT_GAP;
    if (top + COMMENT_BOX_HEIGHT_EST > window.innerHeight - COMMENT_MARGIN) {
      top = rect.top - COMMENT_BOX_HEIGHT_EST - COMMENT_GAP;
    }
    setCommentInputFixedPosition({ top, left });
    setShowCommentInput(true);
  }, []);

  // 演示模式目标池：混排 UI 和文档 ID
  const DEMO_TARGETS = useMemo(() => [
    'ui-price-card', // 1. SAAS 团队版
    'comment_1769941481927_4498', // 2. 文档段落 (快搭规则)
    'ui-upgrade-btn', // 3. SAAS 企业版按钮
    'comment_1769941481927_3427', // 4. 文档段落 (免费期)
    'comment_1769941481927_1241', // 5. 文档段落 (性能优化)
    'comment_1769941481927_9251', // 6. 文档段落 (联系经理)
    'comment_1769941481927_4214'  // 7. 文档段落 (积分保护)
  ], []);

  // 计算传递给 MockSplitView 的高亮 ID
  const mockActiveId = useMemo(() => {
    if (!activeCommentId) return null;

    // 1. 尝试找到对应的评论
    const index = comments.findIndex(c => c.id === activeCommentId || c.target_id === activeCommentId);

    if (index !== -1) {
      const comment = comments[index];
      // A. 手动绑定的目标 (最高优)
      if (comment.target_id || comment.targetId) {
        return comment.target_id || comment.targetId;
      }
      // B. 演示模式自动映射 (AI 评论 fallback) - 仅在 Legacy 模式下生效
      if (isLegacyMode) {
        return DEMO_TARGETS[index] || null;
      }
    }

    // 2. 如果 activeCommentId 本身不是评论 ID (可能是直接设置的 targetID)，则直接使用
    return activeCommentId;
  }, [activeCommentId, comments, DEMO_TARGETS, isLegacyMode]);

  // 带评论高亮锚点的 PRD Markdown（有评论且能匹配时注入 <span id="comment-{id}" class="highlight-target">）
  const prdMarkdown = useMemo(() => {
    if (!prdText) return '';
    if (comments.length === 0) return prdText;
    return buildPrdMarkdownWithHighlights(prdText, comments);
  }, [prdText, comments]);

  // 根据 activeCommentId 仅切换文档内 span 的 highlight-active 类，不重跑 buildPrdMarkdownWithHighlights
  // prdMarkdown 变化时（文档重渲染后）需重新挂载激活态到新 DOM 节点（必须在 prdMarkdown 定义之后）
  useEffect(() => {
    document.querySelectorAll('.highlight-target.highlight-active').forEach((el) => el.classList.remove('highlight-active'));
    const currEl = activeCommentId ? document.getElementById(`comment-${activeCommentId}`) : null;
    if (currEl) currEl.classList.add('highlight-active');
  }, [activeCommentId, prdMarkdown]);

  // 评论列表：新评论增加时自动滚动到底部
  const prevCommentsLengthRef = useRef(comments.length);
  const prevCommentsRef = useRef([]);
  useEffect(() => {
    if (comments.length > prevCommentsLengthRef.current) {
      prevCommentsLengthRef.current = comments.length;
      if (commentListRef.current) {
        commentListRef.current.scrollTo({
          top: commentListRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    } else {
      prevCommentsLengthRef.current = comments.length;
    }
  }, [comments.length]);

  // Agent 自动回复：独立定时器轮询检查未回复的甲方真人评论
  useEffect(() => {
    // 仅当自动回复开启且当前是乙方视角时才启动轮询
    if (!isAutoReplyEnabled || viewRole !== 'vendor') {
      return;
    }

    let cancelled = false;
    let timeoutId = null;

    // 执行一次自动回复检查
    const checkAndAutoReply = async () => {
      if (cancelled || isAutoReplying) return;

      try {
        // 从后端获取最新评论列表
        const response = await axios.get('/api/comments', { timeout: API_TIMEOUT });
        if (!response.data.success) return;

        const allComments = response.data.data.comments || [];

        // 筛选需要自动回复的评论：甲方真人评论且无回复
        const autoReplyTargets = allComments.filter(c =>
          c.author_type === AUTHOR_TYPES.HUMAN_CLIENT && !c.reply_content
        );

        // 如果没有需要回复的评论，继续下一轮轮询
        if (autoReplyTargets.length === 0) return;

        // 取第一条未回复的评论
        const comment = autoReplyTargets[0];

        // 检查是否正在回复同一条评论（避免重复触发）
        if (autoReplyingCommentIdRef.current === comment.id) return;

        // 开始自动回复
        autoReplyingCommentIdRef.current = comment.id;
        setIsAutoReplying(true);
        setIsThoughtChainVisible(true);
        setThoughtChainText(`🔍 检测到新评论：${comment.content.slice(0, 30)}${comment.content.length > 30 ? '...' : ''}`);

        // 使用 SSE 流式接收思维链
        const res = await fetch('/api/vendor/auto-reply-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_id: comment.id }),
        });

        if (!res.ok) {
          throw new Error('请求失败');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.type === 'thinking') {
                setThoughtChainText(`💭 ${payload.title}：${payload.content?.slice(0, 50) || ''}`);
              } else if (payload.type === 'generating') {
                setThoughtChainText('✍️ 正在生成回复...');
              } else if (payload.type === 'done') {
                setThoughtChainText(`✅ 回复已生成：${payload.reply?.slice(0, 40) || ''}...`);
                // 2秒后隐藏思维链
                setTimeout(() => {
                  setIsThoughtChainVisible(false);
                  setThoughtChainText('');
                }, 2000);
              } else if (payload.type === 'error') {
                setThoughtChainText(`❌ 回复失败：${payload.error || '未知错误'}`);
                setTimeout(() => {
                  setIsThoughtChainVisible(false);
                  setThoughtChainText('');
                }, 3000);
              }
            } catch (_) { /* ignore parse errors */ }
          }
        }
      } catch (err) {
        console.error('[自动回复] 轮询失败:', err);
        if (isThoughtChainVisible) {
          setThoughtChainText(`❌ 回复失败：${err.message || '网络错误'}`);
          setTimeout(() => {
            setIsThoughtChainVisible(false);
            setThoughtChainText('');
          }, 3000);
        }
      } finally {
        setIsAutoReplying(false);
        autoReplyingCommentIdRef.current = null;
        // 刷新数据以显示新回复
        fetchData();
      }
    };

    // 开始轮询
    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        await checkAndAutoReply();
        scheduleNext();
      }, AUTO_REPLY_POLL_INTERVAL);
    };

    // 立即执行一次检查，然后开始定时轮询
    checkAndAutoReply().finally(() => {
      if (!cancelled) scheduleNext();
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAutoReplyEnabled, viewRole, isAutoReplying, fetchData]);

  // 持久化开关状态到 localStorage
  useEffect(() => {
    localStorage.setItem('bizagent_auto_reply_enabled', String(isAutoReplyEnabled));
  }, [isAutoReplyEnabled]);

  // 当前视角配置
  const currentRole = VIEW_ROLES[viewRole];

  // 当前视角的消息
  const currentMessages = viewRole === 'client' ? clientMessages : vendorMessages;
  const setCurrentMessages = viewRole === 'client' ? setClientMessages : setVendorMessages;

  // ============================================
  // 初始化和轮询
  // ============================================

  // (Functions moved to top)

  // 初始化：先拉取数据，完成后再拉取 AI 状态，减少首屏并发避免假死
  useEffect(() => {
    let cancelled = false;
    fetchData().finally(() => {
      if (!cancelled) fetchAiStatus();
    });
    return () => { cancelled = true; };
  }, [fetchAiStatus, fetchData]);

  // 轮询：仅在当前一次 fetch 完成后再调度下一次，避免请求堆积（服务端慢时不再叠请求）
  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    const scheduleNext = () => {
      if (cancelled) return;
      // 增加 isReviewing 判断，防止在思考过程中被轮询数据覆盖
      if (isGenerating || isReformatting || isReviewing) {
        timeoutId = setTimeout(scheduleNext, POLL_INTERVAL);
        return;
      }
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        try {
          await fetchData();
        } finally {
          scheduleNext();
        }
      }, POLL_INTERVAL);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchData, isGenerating, isReformatting]);

  // 聊天区：消息/视角更新后若用户不在底部，恢复滚动位置（不自动回到底部）
  useEffect(() => {
    const el = chatScrollRef.current;
    const state = chatScrollStateRef.current;
    if (!el || state.wasAtBottom) return;
    const savedTop = state.scrollTop;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el.scrollTop !== savedTop) el.scrollTop = savedTop;
      });
    });
  }, [clientMessages, vendorMessages, viewRole]);

  // 监听生成状态
  useEffect(() => {
    const unsubscribeStart = eventBus.on(EVENTS.GENERATION_STARTED, () => {
      setIsGenerating(true);
    });
    const unsubscribeComplete = eventBus.on(EVENTS.GENERATION_COMPLETED, () => {
      setIsGenerating(false);
      fetchData();
    });

    return () => {
      unsubscribeStart();
      unsubscribeComplete();
    };
  }, [fetchData]);

  // 监听配置更新（弹窗保存模型配置后刷新顶部 AI 状态）
  useEffect(() => {
    const unsubscribe = eventBus.on(EVENTS.CONFIG_UPDATED, () => {
      fetchAiStatus();
    });
    return () => unsubscribe();
  }, [fetchAiStatus]);

  // 监听 PRD 更新事件（新 PRD 对应新评论，清空旧评论）
  useEffect(() => {
    const unsubscribePrdUpdated = eventBus.on(EVENTS.PRD_UPDATED, (data) => {
      if (data?.prdContent) {
        setPrdText(data.prdContent);
        setComments([]);
        if (data.file_type != null) setPrdFileType(data.file_type);
        if (data.file_path != null) setPrdFileUrl(`/api/file/serve?path=${encodeURIComponent(data.file_path)}`);
        if (data.file_type == null && data.file_path == null) {
          setPrdFileType(null);
          setPrdFileUrl(null);
        }
        console.log('PRD 已更新，来源:', data.source);
      }
    });

    const unsubscribePrdStart = eventBus.on(EVENTS.PRD_GENERATION_STARTED, () => {
      setIsPrdGenerating(true);
      setShowMockView(true); // 触发 Demo 演示模式
    });

    const unsubscribePrdComplete = eventBus.on(EVENTS.PRD_GENERATION_COMPLETED, () => {
      setIsPrdGenerating(false);
    });

    return () => {
      unsubscribePrdUpdated();
      unsubscribePrdStart();
      unsubscribePrdComplete();
    };
  }, []);

  // 点击外部关闭会话下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target)) {
        setIsSessionPanelOpen(false);
      }
    };

    if (isSessionPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSessionPanelOpen]);

  // ============================================
  // 消息发送
  // ============================================

  // 发送内容（供输入框与 Ant Design X Sender 共用）
  const sendContent = async (content) => {
    const text = (typeof content === 'string' ? content : '').trim();
    if (!text || isGenerating) return;

    setInputValue('');
    setIsGenerating(true);
    eventBus.emit(EVENTS.GENERATION_STARTED, {});
    abortControllerRef.current = new AbortController();

    try {
      if (text.startsWith('/')) {
        await handleCommand(text);
      } else {
        const payload = {
          content: text,
          view_role: viewRole,
          ...(selectedUiTarget ? { target_id: selectedUiTarget.id } : {}) // 注入手动选中的目标 ID
        };
        const response = await axios.post('/api/chat/send', payload, { signal: abortControllerRef.current.signal });
        if (response.data.success) {
          setSelectedUiTarget(null); // 发送成功后清除选中状态
          await fetchData();
        }
      }
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error('发送消息失败:', error);
      addSystemMessage(`发送失败: ${error.response?.data?.error || error.message}`);
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
      eventBus.emit(EVENTS.GENERATION_COMPLETED, {});
    }
  };

  // 用户点击「暂停/停止」时取消当前请求并解锁 UI
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsGenerating(false);
    eventBus.emit(EVENTS.GENERATION_COMPLETED, {});
  };

  const handleSendMessage = async () => {
    await sendContent(inputValue);
  };

  // 处理命令
  const handleCommand = async (content) => {
    const command = content.toLowerCase();

    if (command.startsWith('/review') || command.startsWith('/审查')) {
      if (viewRole !== 'client') {
        addSystemMessage('⚠️ 审查功能仅限甲方视角使用');
        return;
      }
      await triggerClientReview();
    } else if (command.startsWith('/help') || command.startsWith('/帮助')) {
      const roleHelp = viewRole === 'client'
        ? '• /review 或 /审查 - 触发 AI 审查当前文档\n'
        : '';
      addSystemMessage(`当前身份：${currentRole.name}（${currentRole.description}）\n\n可用命令：\n${roleHelp}• /status 或 /状态 - 查看 AI 服务状态\n• /clear 或 /清空 - 清空当前聊天记录`);
    } else if (command.startsWith('/status') || command.startsWith('/状态')) {
      await fetchAiStatus();
      addSystemMessage(`AI 服务状态：\n• 提供商: ${aiStatus?.provider || '未知'}\n• 模型: ${aiStatus?.model || '未知'}\n• 状态: ${aiStatus?.isReady ? '就绪' : '未就绪'}`);
    } else if (command.startsWith('/clear') || command.startsWith('/清空')) {
      await axios.post('/api/debug/reset', { keep_config: true });
      await fetchData();
      addSystemMessage('聊天记录已清空');
    } else {
      addSystemMessage(`未知命令: ${content}\n输入 /help 查看帮助`);
    }
  };

  // 添加系统消息（仅本地，根据当前视角）
  const addSystemMessage = (content) => {
    const newMsg = {
      id: `system_${Date.now()}`,
      role: 'system',
      content,
      created_at: new Date().toISOString(),
    };

    if (viewRole === 'client') {
      setClientMessages(prev => [...prev, newMsg]);
    } else {
      setVendorMessages(prev => [...prev, newMsg]);
    }
  };

  // ============================================
  // 甲方审查
  // ============================================

  const triggerClientReview = async () => {
    const trimmed = (prdText || '').trim();
    if (!trimmed) {
      addSystemMessage('请先在预览区输入或粘贴 PRD 内容');
      return;
    }
    if (trimmed.length < MIN_PRD_LENGTH_FOR_REVIEW) {
      addSystemMessage(`预览区内容至少 ${MIN_PRD_LENGTH_FOR_REVIEW} 字后可进行 AI 审查`);
      return;
    }

    setIsReviewing(true);

    // 模拟 4 秒的思考过程
    // 1. 立即插入“思考中”的临时卡片
    const tempId = `thinking_${Date.now()}`;
    const tempMsg = {
      id: tempId,
      role: 'assistant',
      content: (
        <ThinkingAccordion
          loading={true}
          thoughts={MOCK_THOUGHTS}
          duration={4000}
        />
      ),
      created_at: new Date().toISOString(),
    };
    // Optimistically add to client messages
    setClientMessages(prev => [...prev, tempMsg]);

    setTimeout(async () => {
      try {
        const response = await axios.post('/api/client/review', { prd_text: prdText });
        if (response.data.success) {
          const newComments = response.data.data.comments || [];

          // 2. 思考结束，生成最终结果
          const resultMsg = {
            id: `review_result_${Date.now()}`,
            role: 'assistant',
            content: (
              <div className="flex flex-col gap-2">
                <ThinkingAccordion
                  loading={false}
                  thoughts={MOCK_THOUGHTS}
                  duration={4000}
                />
                <div className="text-sm">
                  ✅ 审查完成！经深度分析，发现以下 <span className="font-bold text-red-400">{newComments.length}</span> 个潜在风险点：
                  <br />
                  <span className="text-xs text-gray-500 opacity-80">（详细评论已标注在右侧文档中）</span>
                </div>
              </div>
            ),
            created_at: new Date().toISOString(),
          };

          // Save to ref to persist across polling
          localReviewResultRef.current = resultMsg;

          // Replace temp message
          setClientMessages(prev => prev.map(m => m.id === tempId ? resultMsg : m));

          await fetchData(true); // skipComments=true if supported, or just fetchData
        }
      } catch (error) {
        addSystemMessage(`❌ 审查失败: ${error.response?.data?.error || error.message}`);
        // Remove temp message on error
        setClientMessages(prev => prev.filter(m => m.id !== tempId));
      } finally {
        setIsReviewing(false);
      }
    }, 4000);
  };

  // 新建对话（创建新会话）
  const handleNewChat = async () => {
    if (isGenerating) return;

    try {
      const response = await axios.post('/api/chat/clear', { view_role: viewRole });
      if (response.data.success) {
        // Clear persistent local message
        if (viewRole === 'client') localReviewResultRef.current = null;

        // 清空本地状态
        if (viewRole === 'client') {
          setClientMessages([]);
        } else {
          setVendorMessages([]);
        }
        // 刷新会话列表
        await fetchData();
      }
    } catch (error) {
      console.error('新建对话失败:', error);
      addSystemMessage(`❌ 新建对话失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 切换会话
  const handleSwitchSession = async (sessionId) => {
    if (isGenerating) return;

    try {
      const response = await axios.post('/api/chat/sessions/switch', {
        view_role: viewRole,
        session_id: sessionId
      });
      if (response.data.success) {
        // Clear persistent local message
        if (viewRole === 'client') localReviewResultRef.current = null;

        // 刷新数据
        await fetchData();
        setIsSessionPanelOpen(false);
      }
    } catch (error) {
      console.error('切换会话失败:', error);
      addSystemMessage(`❌ 切换会话失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 删除会话
  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation(); // 阻止事件冒泡
    if (isGenerating) return;

    // 确认删除
    if (!confirm('确定要删除这个会话吗？')) return;

    try {
      const response = await axios.delete(`/api/chat/sessions/${sessionId}`, {
        params: { view_role: viewRole }
      });
      if (response.data.success) {
        // 刷新数据
        await fetchData();
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      addSystemMessage(`❌ 删除会话失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 获取当前视角的会话列表
  const currentSessions = viewRole === 'client' ? clientSessions : vendorSessions;
  const currentSessionId = viewRole === 'client' ? currentClientSessionId : currentVendorSessionId;
  const currentSessionTitle = currentSessions.find(s => s.id === currentSessionId)?.title || '新对话';

  // 回复评论（甲乙双方都可以回复）
  const handleReply = async (commentId) => {
    const replyContent = replyInputs[commentId]?.trim();
    if (!replyContent) {
      addSystemMessage('⚠️ 回复内容不能为空');
      return;
    }

    try {
      const response = await axios.post(`/api/comments/${commentId}/reply`, {
        reply_content: replyContent,
        view_role: viewRole,
      });
      if (response.data.success) {
        addSystemMessage('✅ 回复已发送');
        setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
        await fetchData();
      }
    } catch (error) {
      addSystemMessage(`❌ 回复失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 删除评论（乐观更新，带隔离）
  const handleDeleteComment = async (commentId) => {
    // 乐观更新：立即从 UI 移除
    setComments(prev => prev.filter(c => c.id !== commentId));

    try {
      const response = await axios.delete(`/api/comments/${commentId}`, {
        params: { view_role: viewRole }
      });
      if (!response.data.success) {
        // 回滚：重新获取数据
        await fetchData();
        console.error('[删除评论] 失败:', response.data.error);
      }
    } catch (err) {
      // 回滚：重新获取数据
      await fetchData();
      console.error('[删除评论] 请求失败:', err);
    }
  };

  // ============================================
  // 文件上传
  // ============================================

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      addSystemMessage(`📤 正在上传文件: ${file.name}...`);

      const response = await axios.post('/api/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const { content, type, metadata, file_name, file_path } = response.data.data;
        setPrdText(content);
        setPrdFileType(type || null);
        setPrdFileUrl(file_path ? `/api/file/serve?path=${encodeURIComponent(file_path)}` : null);

        const metaInfo = metadata
          ? `（${type} 格式，${metadata.pages ? metadata.pages + ' 页，' : ''}${metadata.characters || content.length} 字符）`
          : '';

        addSystemMessage(`📄 文件上传成功: ${file_name} ${metaInfo}`);
        if (viewRole === 'client') {
          addSystemMessage('💡 输入 /review 开始审查文档');
        }
        await fetchData();
      } else {
        throw new Error(response.data.error || '上传失败');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      addSystemMessage(`❌ 文件上传失败: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + ' ' +
      date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getAuthorLabel = (authorType) => {
    switch (authorType) {
      case AUTHOR_TYPES.AI_CLIENT: return '甲方 AI';
      case AUTHOR_TYPES.HUMAN_CLIENT: return '甲方';
      case AUTHOR_TYPES.AI_VENDOR: return '乙方 AI';
      case AUTHOR_TYPES.HUMAN_VENDOR: return '乙方';
      case AUTHOR_TYPES.SYSTEM: return '系统';
      default: return '未知';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 获取聊天消息列表（原有逻辑，供非 X 组件或兼容使用）
  const getAllItems = () => {
    return currentMessages.map(msg => ({
      type: 'message',
      id: msg.id,
      content: msg.content,
      role: msg.role,
      time: msg.created_at,
      isError: msg.isError,
    })).sort((a, b) => new Date(a.time) - new Date(b.time));
  };

  // Ant Design X Bubble.List 数据：key、role(user|ai|system)、content
  const bubbleItems = useMemo(() => {
    const sorted = [...currentMessages].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const list = sorted.map((msg) => {
      const role = msg.role === 'assistant' ? 'ai' : (msg.role === 'system' ? 'system' : 'user');
      return {
        key: msg.id,
        role,
        content: msg.content,
        loading: isGenerating && role === 'ai' && sorted.indexOf(msg) === sorted.length - 1,
        ...(msg.isError && { status: 'error' }),
      };
    });
    if (list.length === 0 && isGenerating) {
      list.push({ key: 'loading', role: 'ai', content: '', loading: true });
    }
    return list;
  }, [currentMessages, isGenerating]);

  // ============================================
  // 严格双轨调试机制：点击处理 (Strict Exclusive Toggle)
  // ============================================
  const handleCommentClick = (comment) => {
    // PATH A: STRICT LEGACY MODE
    if (isLegacyMode) {
      console.log(`[🕹️ Legacy Mode] Using keyword/index matching for comment ${comment.id}`);

      // Legacy logic: use comment.id to trigger mockActiveId's fallback mapping
      // or directly trigger document highlight logic
      setIsFallbackActive(true);

      const hasQuoted = Boolean((comment.quote ?? comment.quoted_text ?? '').trim());

      // Set activeCommentId to comment.id, which triggers mockActiveId recalculation
      // (guarded by isLegacyMode in the useMemo)
      setActiveCommentId(comment.id);

      // Manually trigger scroll for document (Old logic)
      setTimeout(() => {
        if (hasQuoted) {
          const el = document.getElementById(`comment-${comment.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 0);

      return; // STRICT: Do not continue to new logic
    }

    // PATH B: STRICT NEW MODE
    const newTargetId = comment.target_id || comment.targetId;
    const hasQuotedText = Boolean((comment.quote ?? comment.quoted_text ?? '').trim());

    if (newTargetId) {
      console.log(`[🚀 New Mode] Highlighting target: ${newTargetId}`);
      setActiveCommentId(newTargetId);
      setIsFallbackActive(false);
    } else if (hasQuotedText) {
      // 手动评论：有 quoted_text，用 comment.id 高亮文档中的对应位置
      console.log(`[📄 Document Highlight] Using quoted_text for comment ${comment.id}`);
      setActiveCommentId(comment.id);
      setIsFallbackActive(false);
      // 滚动到文档中的高亮位置
      setTimeout(() => {
        const el = document.getElementById(`comment-${comment.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    } else {
      console.warn(`[⚠️ No Target] Comment ${comment.id} has neither targetId nor quoted_text.`);
    }
  };

  // ============================================
  // 渲染
  // ============================================

  return (
    <div className="bg-[#09090b] h-screen w-screen overflow-hidden flex flex-col">
      {/* ========== 全局顶部视角切换 ========== */}
      <div className="bg-[#09090b] border-b border-[#27272a] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[#f4f4f5] font-semibold">AI 协作博弈平台</h1>
          {/* 模型状态指示器 + 配置入口，间距 8px */}
          <div className="flex items-center gap-2">
            {/* Debug Toggle */}
            <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#27272a]/50 border border-[#3f3f46] cursor-pointer hover:bg-[#27272a] transition-colors">
              <input
                type="checkbox"
                checked={isLegacyMode}
                onChange={(e) => setIsLegacyMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
              />
              <span className="text-xs text-[#a1a1aa] whitespace-nowrap select-none">强制使用旧模式 (Strict Legacy)</span>
            </label>

            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#18181b] border border-[#27272a]">
              <span className={`w-2 h-2 rounded-full ${aiStatus?.isReady ? 'bg-[#10b981] animate-pulse' : 'bg-[#ef4444]'
                }`} />
              <span className="text-xs text-[#a1a1aa]">
                {aiStatus?.provider === 'mock' && '🧪 Mock 模式'}
                {aiStatus?.provider === 'ollama' && `🦙 ${aiStatus?.model || 'Ollama'}`}
                {aiStatus?.provider === 'kimi' && `🌙 ${aiStatus?.model || 'Kimi'}`}
                {!aiStatus?.provider && '加载中...'}
              </span>
              <span className={`text-xs ${aiStatus?.isReady ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {aiStatus?.isReady ? '就绪' : '未连接'}
              </span>
            </div>
            <button
              className="rounded-lg size-8 flex items-center justify-center cursor-pointer hover:bg-[#27272a] transition-colors shrink-0"
              onClick={() => setIsConfigOpen(true)}
              title="打开配置面板"
            >
              <div className="size-4 text-[#71717b]">
                <IconMenu />
              </div>
            </button>
          </div>
        </div>

        {/* 视角切换 Tab 和模型释放按钮 */}
        <div className="flex items-center gap-4">
          {/* 模型释放按钮 */}
          {aiStatus?.provider === 'ollama' && (
            <button
              onClick={handleUnloadModel}
              disabled={isUnloading || isGenerating}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 flex items-center gap-1.5 ${isUnloading
                ? 'bg-[#27272a] border-[#3f3f46] text-[#71717a] cursor-wait'
                : 'bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] hover:border-[#3f3f46]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="释放本地模型以回收内存"
            >
              {isUnloading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>释放中...</span>
                </>
              ) : (
                <>
                  <span>🧹</span>
                  <span>释放模型</span>
                </>
              )}
            </button>
          )}

          <span className="text-[#71717a] text-sm">切换视角：</span>
          <div className="flex rounded-lg border border-[#27272a] overflow-hidden">
            {Object.entries(VIEW_ROLES).map(([key, role]) => (
              <button
                key={key}
                onClick={() => setViewRole(key)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${viewRole === key
                  ? `${role.color.bgLight} ${role.color.text}`
                  : 'bg-[#18181b] text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa]'
                  }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========== 主内容区 ========== */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ========== 左侧聊天栏 ========== */}
        <div className="chat-panel-dark bg-[#18181b] border-[#27272a] border-r border-solid flex flex-col h-full items-start shadow-[0px_20px_25px_0px_rgba(0,0,0,0.2)] w-[24%] min-w-[300px] flex-shrink-0">

          {/* 顶部标题栏 - 根据视角变色 */}
          <div className={`bg-[rgba(9,9,11,0.5)] border-b border-solid h-[61px] relative shrink-0 w-full ${currentRole.color.border}`}>
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex gap-3 items-center flex-1 min-w-0">
                {/* 会话选择器下拉菜单 */}
                <div className="relative flex-1 min-w-0" ref={sessionDropdownRef}>
                  <button
                    onClick={() => setIsSessionPanelOpen(!isSessionPanelOpen)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#27272a] transition-colors w-full text-left ${isSessionPanelOpen ? 'bg-[#27272a]' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#f4f4f5] text-sm truncate">{currentSessionTitle}</p>

                    </div>
                    <div className={`size-4 text-[#71717b] shrink-0 transition-transform ${isSessionPanelOpen ? 'rotate-180' : ''}`}>
                      <IconChevronDown />
                    </div>
                  </button>

                  {/* 下拉菜单 */}
                  {isSessionPanelOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="max-h-[280px] overflow-y-auto">
                        {currentSessions.length === 0 ? (
                          <div className="text-center text-[#52525c] py-4 text-xs">
                            暂无会话历史
                          </div>
                        ) : (
                          currentSessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => handleSwitchSession(session.id)}
                              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${session.is_current
                                ? 'bg-[#27272a]'
                                : 'hover:bg-[#27272a]/50'
                                }`}
                            >
                              {/* 选中指示器 */}
                              <div className={`size-4 shrink-0 ${session.is_current ? 'text-[#10b981]' : 'text-transparent'}`}>
                                <IconCheck />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${session.is_current ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'}`}>
                                  {session.title}
                                </p>
                                <p className="text-[10px] text-[#52525c]">
                                  {session.message_count} 条消息
                                </p>
                              </div>

                              {/* 删除按钮 */}
                              {!session.is_current && (
                                <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-[#71717a] hover:text-red-400 transition-all shrink-0"
                                  title="删除会话"
                                >
                                  <div className="size-3.5">
                                    <IconTrash />
                                  </div>
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 新建对话按钮 */}
              <button
                className="rounded-lg size-8 flex items-center justify-center cursor-pointer hover:bg-[#27272a] transition-colors shrink-0 ml-2"
                onClick={handleNewChat}
                disabled={isGenerating}
                title="新建对话"
              >
                <div className="size-4 text-[#71717b]">
                  <IconPlus />
                </div>
              </button>
            </div>
          </div>

          {/* 消息列表：Ant Design X Bubble.List */}
          <div
            ref={chatScrollRef}
            className="flex-1 min-h-0 relative w-full overflow-y-auto p-4 chat-scroll-no-anchor"
            onScroll={(e) => {
              const el = e.target;
              chatScrollStateRef.current = {
                scrollTop: el.scrollTop,
                wasAtBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 50,
              };
            }}
          >
            {bubbleItems.length === 0 && !isGenerating ? (
              <div className="text-center text-[#52525c] py-8" />
            ) : (
              <Bubble.List
                items={bubbleItems}
                role={{ user: { placement: 'end' }, ai: { placement: 'start' } }}
                autoScroll
                className="h-full"
                style={{ minHeight: 200 }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 底部输入区：Ant Design X Sender + 工具栏 */}
          <div className="bg-[#09090b] border-[#27272a] border-solid border-t relative shrink-0 w-full px-4 pt-4 pb-3">

            <div className="bg-[#18181b] rounded-xl overflow-hidden">
              <Sender
                value={inputValue}
                onChange={(v) => setInputValue(v ?? '')}
                placeholder={currentRole.chatPlaceholder}
                loading={isGenerating}
                onSubmit={(message) => sendContent(message)}
                onCancel={handleCancelGeneration}
                submitType="enter"
              />
            </div>
            {uploadedFile && (
              <div className="mt-2 text-xs text-[#71717b]">
                📄 {uploadedFile.name}
              </div>
            )}

          </div>
        </div>

        {/* ========== 中间 PRD 预览区 ========== */}
        <div className={`bg-[#09090b] h-full flex-1 flex flex-col overflow-hidden p-4 transition-all duration-300 ${isCommentPanelOpen ? 'w-[56%]' : 'w-[76%]'
          }`}>
          <div className="bg-[rgba(24,24,27,0.5)] border border-[#27272a] border-solid flex flex-col h-full overflow-hidden rounded-xl">
            <div className="border-b border-[#27272a] px-4 py-3 text-sm text-[#a1a1aa] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>PRD 文档预览</span>
              </div>
              <div className="flex items-center gap-2">
                {viewRole === 'client' && (
                  <button
                    onClick={triggerClientReview}
                    disabled={isGenerating || isReviewing || !prdText || prdText.trim().length < MIN_PRD_LENGTH_FOR_REVIEW}
                    className="rounded-md px-2 py-1 text-xs font-medium bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46] disabled:opacity-50 flex items-center gap-1.5"
                    title={
                      isReviewing
                        ? '正在审查文档...'
                        : !prdText?.trim()
                          ? '请先在预览区输入或粘贴 PRD 内容'
                          : prdText.trim().length < MIN_PRD_LENGTH_FOR_REVIEW
                            ? `预览区内容至少 ${MIN_PRD_LENGTH_FOR_REVIEW} 字后可进行 AI 审查`
                            : '根据当前预览内容进行 AI 审查'
                    }
                  >
                    {isReviewing ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-[#71717a] border-t-[#e4e4e7] rounded-full animate-spin shrink-0" aria-hidden />
                        <span>审查中...</span>
                      </>
                    ) : (
                      'AI 审查文档'
                    )}
                  </button>
                )}
              </div>
              {/* PRD 生成中状态指示器 */}
              {isPrdGenerating && (
                <div className="flex items-center gap-2 text-[#10b981]">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs">正在生成...</span>
                </div>
              )}
            </div>
            <div
              ref={docViewerScrollRef}
              className="flex-1 overflow-auto min-h-0 relative"
            >
              {/* NUCLEAR OPTION: Force render MockSplitView for demo - always show */}
              <MockSplitView
                activeId={mockActiveId}
                onSelectElement={handleUiSelect}
                onTextSelect={handleTextSelect}
                isLegacyMode={isLegacyMode}
                isFallbackActive={isFallbackActive}
                isThinking={isAiThinking}
                isReviewing={isReviewing}
                comments={comments}
              />


              {/* 文本选中评论：浮动条（防止点击时丢失选区，用 onMouseDown preventDefault；仅文本预览时可用） */}
              {prdText && selectedText && toolbarPosition && !showCommentInput && (
                <div
                  className="absolute z-50 bg-zinc-900 text-white rounded-md shadow-xl border border-zinc-700 px-2 py-1.5 flex items-center gap-1 comment-toolbar-enter"
                  style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openCommentInput}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-700 text-sm font-medium transition-colors"
                  >
                    💬 评论
                  </button>
                </div>
              )}

              {/* 文本选中评论：全屏透明遮罩（阻止点击文档，点击视为取消） */}
              {prdText && showCommentInput && (
                <div
                  className="fixed inset-0 z-40"
                  style={{ background: 'transparent' }}
                  onClick={handleCommentCancel}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-hidden
                />
              )}
              {/* 文本选中评论：输入框（fixed 定位，边界安全，淡入/缩放动画） */}
              {prdText && showCommentInput && commentInputFixedPosition && (
                <div
                  data-testid="comment-input-popup"
                  className="fixed z-[9999] w-64 p-3 bg-zinc-800 rounded-lg shadow-2xl border border-zinc-700 comment-input-popover-enter"
                  style={{
                    top: commentInputFixedPosition.top,
                    left: commentInputFixedPosition.left,
                  }}
                  onClick={(e) => {
                    // 阻止事件冒泡到遮罩层
                    e.stopPropagation();
                    console.log('[输入框容器] 被点击');
                  }}
                >
                  <textarea
                    ref={commentTextareaRef}
                    value={commentInputValue}
                    onChange={(e) => setCommentInputValue(e.target.value)}
                    placeholder="请输入评审意见..."
                    rows={3}
                    className="w-full resize-none rounded-md bg-zinc-900 border border-zinc-600 text-[#e4e4e7] placeholder:text-zinc-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCommentCancel}
                      className="px-3 py-1.5 text-sm rounded-md bg-zinc-600 text-[#e4e4e7] hover:bg-zinc-500 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // 防止失去焦点
                        e.stopPropagation();
                        console.log('[发送按钮] mousedown 触发提交！');
                        submitSelectionComment();
                      }}
                      className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                    >
                      发送
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== 右侧评论面板 ========== */}
        <div className={`bg-[#18181b] border-l border-[#27272a] h-full flex flex-col transition-all duration-300 ${isCommentPanelOpen ? 'w-[320px]' : 'w-0'
          } overflow-hidden`}>
          {isCommentPanelOpen && (
            <>
              {/* 评论面板头部 */}
              <div className={`flex items-center justify-between h-[52px] px-4 border-b shrink-0 ${currentRole.color.border} bg-[rgba(9,9,11,0.5)]`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#a1a1aa]">
                    评论（{comments.length}）
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Agent 自动回复开关 - 仅乙方视角可见 */}
                  {viewRole === 'vendor' && (
                    <label className="flex items-center gap-2 cursor-pointer" title="开启后，乙方 AI 将自动回复甲方真人评论">
                      <span className="text-xs text-[#71717a]">Agent 自动回复</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAutoReplyEnabled}
                        onClick={() => setIsAutoReplyEnabled(prev => !prev)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#18181b] ${isAutoReplyEnabled ? 'bg-[#10b981]' : 'bg-[#3f3f46]'
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAutoReplyEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                      </button>
                      {isAutoReplying && (
                        <span className="w-3 h-3 border-2 border-[#3f3f46] border-t-[#10b981] rounded-full animate-spin" title="正在自动回复..." />
                      )}
                    </label>
                  )}
                  <button
                    onClick={() => setIsCommentPanelOpen(false)}
                    className="text-[#71717a] hover:text-[#a1a1aa] transition-colors text-lg font-light"
                    title="收起评论面板"
                  >
                    »
                  </button>
                </div>
              </div>

              {/* 思维链单行显示区域 - 仅乙方视角且正在回复时显示 */}
              {isThoughtChainVisible && viewRole === 'vendor' && (
                <div className="bg-gradient-to-r from-[#10b981]/10 to-[#3b82f6]/10 border-b border-[#27272a] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm text-[#a1a1aa] thought-chain-text" key={thoughtChainText}>
                        {thoughtChainText || '🤖 Agent 思考中...'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsThoughtChainVisible(false)}
                      className="text-[#71717a] hover:text-[#a1a1aa] text-sm shrink-0"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* 已锁定目标指示器 - 当用户点击 UI 元素后显示 */}
              {selectedUiTarget && (
                <div className="bg-gradient-to-r from-[#3b82f6]/20 to-[#8b5cf6]/20 border-b border-[#27272a] px-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <span className="text-xs text-[#60a5fa] font-medium">已锁定目标:</span>
                      <span className="text-xs text-[#a1a1aa]">{selectedUiTarget.name || selectedUiTarget.id}</span>
                    </div>
                    <button
                      onClick={() => setSelectedUiTarget(null)}
                      className="text-[#71717a] hover:text-[#ef4444] text-xs px-1.5 py-0.5 rounded hover:bg-[#27272a] transition-colors"
                      title="取消锁定"
                    >
                      ✕ 取消
                    </button>
                  </div>
                  <p className="text-[10px] text-[#52525c] mt-1">发送评论时将自动绑定到此目标</p>
                </div>
              )}

              {/* 评论列表 */}
              <div ref={commentListRef} className="bg-[#09090b] border-[#27272a] border-solid border-t relative w-full p-4 flex-1 overflow-y-auto min-h-0">
                {isReviewing && comments.length === 0 ? (
                  /* 审查中：骨架屏 */
                  <div className="py-2 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={`skeleton-${i}`} className="px-4 py-3 rounded-lg">
                        <div className="flex gap-3">
                          <div className="w-1 rounded-full bg-[#3f3f46] shrink-0 animate-pulse" />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="h-4 w-16 rounded bg-[#27272a] animate-pulse" />
                              <span className="h-3 w-14 rounded bg-[#27272a]/80 animate-pulse" />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#27272a] animate-pulse shrink-0" />
                              <span className="h-3 w-12 rounded bg-[#27272a]/80 animate-pulse" />
                              <span className="h-3 w-20 rounded bg-[#27272a]/60 animate-pulse" />
                            </div>
                            <div className="space-y-1.5">
                              <div className="h-3 w-full max-w-[95%] rounded bg-[#27272a] animate-pulse" />
                              <div className="h-3 w-full max-w-[80%] rounded bg-[#27272a] animate-pulse" />
                              <div className="h-3 w-3/4 rounded bg-[#27272a]/80 animate-pulse" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-[#52525c] text-center py-12 px-4">
                    <p className="text-sm">暂无评论</p>
                    <p className="text-xs mt-2">
                      {viewRole === 'client'
                        ? `在文档中选中文本即可添加评论，或点击「AI 审查文档」自动分析`
                        : '在文档中选中文本即可添加评论'}
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {comments.map((comment, index) => {
                      // 优先级逻辑：
                      // 1. 手动绑定 (comment.target_id) -> 最高优先级
                      // 2. 文档引用 (hasQuoted) -> 此时 effectiveTargetId = comment.id
                      // 3. 演示模式 fallback (DEMO_TARGETS) -> 只有前两者都无效时才启用

                      const hasQuoted = Boolean((comment.quote ?? comment.quoted_text ?? '').trim());
                      const manualTargetId = comment.target_id || comment.targetId; // 后端返回的明确 ID
                      const demoTargetId = DEMO_TARGETS[index] || null;

                      let effectiveTargetId = null;
                      let isUiTarget = false;

                      if (manualTargetId) {
                        // 1. 明确指定了目标 (手动发送或特定逻辑)
                        effectiveTargetId = manualTargetId;
                        isUiTarget = manualTargetId.startsWith('ui-');
                      } else if (hasQuoted) {
                        // 2. 文档引用
                        effectiveTargetId = comment.id;
                        isUiTarget = false;
                      } else {
                        // 3. 演示模式 Fallback
                        effectiveTargetId = demoTargetId;
                        isUiTarget = demoTargetId && demoTargetId.startsWith('ui-');
                      }

                      const isClickable = Boolean(effectiveTargetId);
                      const isActive = activeCommentId === effectiveTargetId;

                      return (
                        <div
                          key={comment.id}
                          className={`group px-4 py-3 transition-all duration-200 rounded ${isClickable ? 'cursor-pointer hover:bg-[#27272a]/30' : ''} ${isActive ? 'border-l-4 border-amber-500 bg-amber-500/10 shadow-md' : ''}`}
                          onClick={() => handleCommentClick(comment)}
                          role={isClickable ? 'button' : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCommentClick(comment);
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${comment.author_type === AUTHOR_TYPES.HUMAN_VENDOR || comment.author_type === AUTHOR_TYPES.AI_VENDOR
                                  ? 'bg-[#3b82f6]/20 text-[#60a5fa]'
                                  : 'bg-[#f59e0b]/20 text-[#fbbf24]'
                                  }`}>
                                  {comment.author_type === AUTHOR_TYPES.HUMAN_VENDOR || comment.author_type === AUTHOR_TYPES.AI_VENDOR ? '乙' : '甲'}
                                </div>
                                <span className="text-xs text-[#a1a1aa]">
                                  {getAuthorLabel(comment.author_type)}
                                </span>
                                <span className="text-xs text-[#52525c]">
                                  {formatDate(comment.created_at)}
                                </span>
                                {/* 删除按钮 - 只有己方评论才显示 */}
                                {((viewRole === 'client' && (comment.author_type === AUTHOR_TYPES.AI_CLIENT || comment.author_type === AUTHOR_TYPES.HUMAN_CLIENT)) ||
                                  (viewRole === 'vendor' && (comment.author_type === AUTHOR_TYPES.AI_VENDOR || comment.author_type === AUTHOR_TYPES.HUMAN_VENDOR))) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteComment(comment.id);
                                      }}
                                      className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-[#71717a] hover:text-red-400 transition-all"
                                      title="删除评论"
                                    >
                                      <div className="size-3.5">
                                        <IconTrash />
                                      </div>
                                    </button>
                                  )}
                              </div>

                              <p className="text-sm text-[#e4e4e7] leading-relaxed">
                                {comment.content}
                              </p>

                              {/* 回复区域（阻止点击冒泡，避免触发整卡滚动） */}
                              {comment.reply_content ? (
                                <div className="mt-3 pl-3 border-l-2 border-[#3f3f46]" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${comment.reply_author_type === 'HUMAN_VENDOR' || comment.reply_author_type === 'AI_VENDOR'
                                      ? 'bg-[#3b82f6]/20 text-[#60a5fa]'
                                      : 'bg-[#f59e0b]/20 text-[#fbbf24]'
                                      }`}>
                                      {comment.reply_author_type === 'HUMAN_VENDOR' || comment.reply_author_type === 'AI_VENDOR' ? '乙' : '甲'}
                                    </div>
                                    <span className="text-xs text-[#71717a]">
                                      {comment.reply_author_type === 'HUMAN_VENDOR' ? '乙方回复' :
                                        comment.reply_author_type === 'AI_VENDOR' ? '乙方 AI 回复' :
                                          comment.reply_author_type === 'HUMAN_CLIENT' ? '甲方回复' : '甲方 AI 回复'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#a1a1aa] leading-relaxed">
                                    {comment.reply_content}
                                  </p>
                                </div>
                              ) : (
                                /* 甲乙双方都可以回复（阻止点击冒泡） */
                                <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={replyInputs[comment.id] || ''}
                                      onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          handleReply(comment.id);
                                        }
                                      }}
                                      placeholder="输入回复..."
                                      disabled={isGenerating}
                                      className="flex-1 bg-[#09090b] border border-[#27272a] rounded px-2 py-1 text-xs text-[#f4f4f5] placeholder-[#52525c] focus:outline-none focus:border-[#52525c] disabled:opacity-50"
                                    />
                                    <button
                                      onClick={() => handleReply(comment.id)}
                                      disabled={isGenerating || !replyInputs[comment.id]?.trim()}
                                      className="px-2 py-1 text-xs bg-[#3f3f46] text-[#f4f4f5] rounded hover:bg-[#52525c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      发送
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 评论面板收起时的展开按钮 */}
        {!isCommentPanelOpen && (
          <button
            onClick={() => setIsCommentPanelOpen(true)}
            className={`absolute right-0 top-1/2 -translate-y-1/2 ${currentRole.color.bgLight} hover:opacity-80 border ${currentRole.color.border} rounded-l-lg px-2 py-4 ${currentRole.color.text} transition-colors z-10`}
            title="展开评论面板"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">«</span>
              <span className="text-xs writing-mode-vertical">评论 ({comments.length})</span>
            </div>
          </button>
        )}
      </div>

      {/* 配置抽屉 - 左侧滑入，宽度 500px */}
      <Drawer
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        title="AI 能力配置"
      >
        <Suspense fallback={<div className="flex items-center justify-center p-8 text-[#71717a]">加载配置中...</div>}>
          <AppConfig isEmbedded={true} />
        </Suspense>
      </Drawer>
    </div>
  );
}
