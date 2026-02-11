import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { message } from 'antd';
import useMediaQuery from '../hooks/useMediaQuery';
import AiAssistantSidebar from './AiAssistantSidebar';
import MobileHeader from './MobileHeader';
import DesktopHeader from './DesktopHeader';
import MockSplitView from '../MockSplitView';
import CommentsPanel from './CommentsPanel';
import BottomSheet from './BottomSheet';
import AgentProcessCycle from './AgentProcessCycle';
import VersionSelector from './VersionSelector';
import FeedbackSummaryCard from './FeedbackSummaryCard';
import { IconAI, IconMenu, IconSend } from '../svg-icons';
import { useChatStore } from '../store/chatStore';

/**
 * ProgressiveLayout - 渐进式展开布局容器
 *
 * 状态机：
 * - 'chat':           纯聊天阶段（居中/全屏）
 * - 'split':          文档展开（桌面二栏 / 移动端全屏文档）
 * - 'split_comments': 评论展开（桌面三栏 / 移动端 BottomSheet）
 *
 * 移动端额外状态：
 * - mobilePanel: 'chat' | 'document'
 * - commentSheetOpen: boolean
 */
export default function ProgressiveLayout({
    // === 状态 ===
    comments,
    activeId,
    currentRole,
    // agentEnabled, // Managed by store
    vendorConfig,
    // isAgentTyping, // Managed by store

    // === 回调 ===
    onCommentClick,
    onElementClick,
    onReply,
    onDeleteComment,
    onTextSelect,
    onSubmit,

    // === Refs ===
    sidebarRef,
    scrollContainerRef,

    // === UI 状态 ===
    toolbarPosition,
    isInputOpen,
    inputValue,
    selectedText,

    // === UI 回调 ===
    setInputValue,
    setIsInputOpen,
    handleOpenInput,
    handleAiReviewTrigger,
    handleAiAnalysisComplete,

    // === 配置抽屉 ===
    setIsConfigOpen,

    // === Agent 控制 ===
    setAgentEnabled,
    setCurrentRole,
    // setIsAgentTyping, // Managed by store now

    // === 评论卡片渲染函数 (由 DualRoleView 传入) ===
    renderComment,

    // === V4.0: 版本管理 ===
    documentVersions,
    activeVersionIndex,
    onVersionSwitch,
    onPublishCurrentVersion,

    // === V4.0: 评论总结 ===
    feedbackSummary,
    isSummarizing,
    onSummarizeComments,
    onApplyAdjustments,
    onDismissSummary,
    hasHumanClientComments,
}) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [messageApi, contextHolder] = message.useMessage();

    // ===== 版本可见性控制 =====
    // 根据当前角色过滤可见版本
    const visibleVersions = React.useMemo(() => {
        if (!documentVersions) return [];
        if (currentRole === 'PARTY_B') {
            // 乙方：能看到所有版本
            return documentVersions;
        }
        // 甲方：只能看到 public 的版本
        return documentVersions.filter(v =>
            v.visibility === 'public' || !v.visibility // 兼容旧数据
        );
    }, [documentVersions, currentRole]);

    // 检查是否有草稿版本（仅甲方使用）
    const hasVendorDraft = React.useMemo(() => {
        if (currentRole !== 'PARTY_A' || !documentVersions) return false;
        return documentVersions.some(v => v.visibility === 'vendor_only');
    }, [documentVersions, currentRole]);

    // 计算在可见版本列表中的索引（用于 VersionSelector 显示）
    const visibleActiveIndex = React.useMemo(() => {
        if (!documentVersions || activeVersionIndex < 0) return 0;
        const currentVersion = documentVersions[activeVersionIndex];
        if (!currentVersion) return 0;
        return visibleVersions.findIndex(v => v.id === currentVersion.id);
    }, [documentVersions, activeVersionIndex, visibleVersions]);

    // ===== 渐进式展开状态（按角色隔离） =====
    const [viewStageMap, setViewStageMap] = useState({ PARTY_A: 'chat', PARTY_B: 'chat' });
    const viewStage = viewStageMap[currentRole] || 'chat';
    const setViewStage = useCallback((stage) => {
        setViewStageMap(prev => ({ ...prev, [currentRole]: stage }));
    }, [currentRole]);

    const [mobilePanelMap, setMobilePanelMap] = useState({ PARTY_A: 'chat', PARTY_B: 'chat' });
    const mobilePanel = mobilePanelMap[currentRole] || 'chat';
    const setMobilePanel = useCallback((panel) => {
        setMobilePanelMap(prev => ({ ...prev, [currentRole]: panel }));
    }, [currentRole]);

    const [commentSheetOpen, setCommentSheetOpen] = useState(false);

    // ===== 状态转换回调 =====

    // 文档卡片点击 → 展开文档区
    const handleDocumentOpen = useCallback(() => {
        if (isMobile) {
            setMobilePanel('document');
        }
        setViewStage('split');
    }, [isMobile, setMobilePanel, setViewStage]);

    // 高亮文字点击 → 展开评论区 + 原有逻辑
    const handleHighlightClick = useCallback((targetId) => {
        // 调用原有的元素点击逻辑（评论定位 + 高亮）
        onElementClick?.(targetId);

        // 展开评论区
        if (isMobile) {
            setCommentSheetOpen(true);
        } else {
            setViewStage('split_comments');
        }
    }, [isMobile, onElementClick, setViewStage]);

    // 评论区关闭
    const handleCloseComments = useCallback(() => {
        if (isMobile) {
            setCommentSheetOpen(false);
        } else {
            setViewStage('split');
        }
    }, [isMobile, setViewStage]);

    // 移动端返回聊天
    const handleBackToChat = useCallback(() => {
        setMobilePanel('chat');
        setViewStage('chat');
    }, [setMobilePanel, setViewStage]);

    // 桌面端关闭文档区 → 回到纯聊天
    const handleCloseDocument = useCallback(() => {
        setViewStage('chat');
    }, [setViewStage]);

    // 评论卡片点击（包装原回调，移动端需要切换到文档视图）
    const handleCommentClickWrapped = useCallback((id, blockId) => {
        onCommentClick?.(id, blockId);

        // 移动端：如果在聊天视图，需要先切到文档
        if (isMobile && mobilePanel === 'chat') {
            setMobilePanel('document');
            setViewStage('split');
        }
    }, [isMobile, mobilePanel, onCommentClick, setMobilePanel, setViewStage]);

    // Widget 点击回调（拦截 gateway 类型触发文档展开）
    const handleWidgetClick = useCallback((type, data) => {
        if (type === 'gateway') {
            handleDocumentOpen();
        }
    }, [handleDocumentOpen]);

    // 乙方发起需求确认 → 发布当前版本 + 设置标志位，甲方视角显示通知横条
    const handleSendRequirementConfirmation = useCallback(() => {
        const { setRequirementConfirmPending, setRequirementConfirmSent } = useChatStore.getState();

        // 1. 将当前版本设置为 public
        onPublishCurrentVersion?.();

        // 2. 设置需求确认标志位（甲方通知横条）
        setRequirementConfirmPending(true);

        // 3. 标记已发送（按钮变为不可点击纯文本）
        setRequirementConfirmSent(true);

        // 4. Toast 提示
        messageApi.success('需求确认已发送至甲方');
    }, [onPublishCurrentVersion, messageApi]);

    // 甲方点击通知横条「查看需求文档」→ 注入用户消息 + 打开文档 + 清除通知
    const handleAcceptRequirementConfirm = useCallback(() => {
        const { setClientMessages, setRequirementConfirmPending } = useChatStore.getState();

        // 1. 注入一条甲方的 user 消息，让聊天区有内容
        setClientMessages(prev => [...prev, {
            key: `user_view_doc_${Date.now()}`,
            role: 'user',
            content: '查看需求文档',
        }]);

        // 2. 打开文档区
        setViewStage('split');

        // 3. 移动端也需要切到文档面板
        if (isMobile) {
            setMobilePanel('document');
        }

        // 4. 清除通知横条
        setRequirementConfirmPending(false);
    }, [setViewStage, isMobile, setMobilePanel]);

    // 从 store 读取需求确认标志位
    const requirementConfirmPending = useChatStore(s => s.requirementConfirmPending);
    const requirementConfirmSent = useChatStore(s => s.requirementConfirmSent);

    // ===== 自动避让逻辑 (Mobile Auto-Scroll) =====
    // 当 BottomSheet 打开时，确保高亮区域不被遮挡
    React.useEffect(() => {
        if (!isMobile || !commentSheetOpen || !activeId) return;

        // 延迟执行，等待 BottomSheet 动画开始或 DOM 渲染就绪
        const timer = setTimeout(() => {
            // 1. 找到对应的评论数据
            const comment = comments.find(c => c.id === activeId);
            if (!comment || !comment.anchor?.blockId) return;

            // 2. 找到对应的高亮 Block 元素
            const blockEl = document.getElementById(comment.anchor.blockId);
            if (!blockEl) return;

            // 3. 计算位置
            const rect = blockEl.getBoundingClientRect();
            // 假设 BottomSheet 初始高度为 40%，预留一些安全边距
            const sheetHeight = window.innerHeight * 0.4;
            const visibleBottom = window.innerHeight - sheetHeight - 50; // 50px 安全边距

            // 4. 如果元素底部被遮挡，通过 scrollContainerRef 滚动
            // 注意：这里我们移动的是 scrollContainerRef，而不是 window
            if (rect.bottom > visibleBottom) {
                // 计算需要滚动的距离
                // 我们希望元素显示在可视区域中间偏上位置
                const targetTop = rect.top - (visibleBottom / 2) + (rect.height / 2); // 粗略居中

                // 使用 scrollBy 进行平滑滚动
                // 或者使用 scrollIntoView (Risk Mitigation #3)
                blockEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center', // 垂直居中，最稳妥的策略
                });
            }
        }, 100); // 100ms 延迟，确保 Sheet 已经占据空间逻辑（虽然是 fixed，但防止动画冲突）

        return () => clearTimeout(timer);
    }, [isMobile, commentSheetOpen, activeId, comments]);

    // ===== 渲染浮动工具栏（评论输入） =====
    const renderToolbar = () => {
        // Mobile Toolbar (Fixed Bottom)
        if (isMobile) {
            if (!selectedText) return null;

            // If input is open (BottomSheet), don't show this toolbar
            if (commentSheetOpen) return null;

            return (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <button
                        onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
                        onClick={() => {
                            setCommentSheetOpen(true);
                            // Small delay to allow sheet to open before focusing? 
                            // Actually BottomSheet usually handles focus if input is inside.
                            // But here we need to switch mode to "inputting"
                            setIsInputOpen(true);
                        }}
                        className="bg-zinc-800/90 backdrop-blur-md border border-zinc-700 shadow-2xl text-white px-6 py-3 rounded-full text-sm font-semibold flex items-center gap-2 active:scale-95 transition-transform"
                    >
                        <span>💬</span>
                        <span>添加评论</span>
                    </button>
                    {/* Optional: Add Copy button or others here */}
                </div>
            );
        }

        // Desktop Toolbar (Floating near selection)
        if (!toolbarPosition) return null;

        return (
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
                        <div className="text-xs text-zinc-400 border-l-2 border-yellow-500 pl-2 mb-1 truncate">Target: &quot;{selectedText}&quot;</div>
                        <textarea
                            autoFocus
                            className="bg-black/50 border border-zinc-700 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                            rows={3}
                            placeholder="Type your comment..."
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsInputOpen(false)} className="text-xs text-zinc-400 hover:text-white px-2">Cancel</button>
                            <button onClick={onSubmit} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-500 font-medium">Post</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ===== 渲染文档区 =====
    const renderDocumentView = () => (
        <div className="h-full w-full overflow-hidden relative flex flex-col" ref={scrollContainerRef}>
            {/* 甲方草稿通知横条 */}
            {currentRole === 'PARTY_A' && hasVendorDraft && (
                <div className="shrink-0 px-4 py-2.5 bg-blue-600/10 border-b border-blue-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                    <span className="text-xs text-blue-200 flex-1">
                        乙方正在根据您的反馈调整文档，调整完成后会通知您查看
                    </span>
                </div>
            )}

            {/* 文档区头部（版本选择器 + 关闭按钮） */}
            <div className="shrink-0">
                {documentVersions && documentVersions.length > 0 && (
                    <VersionSelector
                        versions={visibleVersions}
                        activeIndex={visibleActiveIndex}
                        onSwitch={onVersionSwitch}
                        rightContent={
                            !isMobile && (
                                <div className="flex items-center gap-2">
                                    {currentRole === 'PARTY_B' && (
                                        requirementConfirmSent ? (
                                            <span className="px-3 py-1 text-xs font-medium text-zinc-400">
                                                已发起需求确认
                                            </span>
                                        ) : (
                                            <button
                                                onClick={handleSendRequirementConfirmation}
                                                className="px-3 py-1 rounded-md text-xs font-medium transition-all bg-blue-600 text-white hover:bg-blue-500"
                                            >
                                                发起需求确认
                                            </button>
                                        )
                                    )}
                                    <button
                                        onClick={handleCloseDocument}
                                        className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-zinc-700"
                                        title="收起文档区"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            )
                        }
                    />
                )}
                {!documentVersions && !isMobile && (
                    <div className="h-11 flex items-center justify-between px-4 bg-zinc-900/80 border-b border-zinc-800/50">
                        <span className="text-sm font-medium text-zinc-300">文档预览</span>
                        <button
                            onClick={handleCloseDocument}
                            className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-zinc-700"
                            title="收起文档区"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
            {/* 文档内容 */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <MockSplitView
                    activeCommentId={activeId}
                    activeUiId={comments.find(c => c.id === activeId)?.anchor?.uiRef || null}
                    comments={comments}
                    onTextSelect={onTextSelect}
                    isThinking={false}
                    isReviewing={false}
                    activeSection={null}
                    onSelectElement={handleHighlightClick}
                    isLegacyMode={false}
                    isFallbackActive={false}
                />
                {renderToolbar()}
            </div>
        </div>
    );

    // ===== 渲染评论面板 =====
    const renderCommentsPanel = (showClose = true) => (
        <div className="h-full flex flex-col">
            <CommentsPanel
                comments={comments}
                activeId={activeId}
                onCommentClick={handleCommentClickWrapped}
                onReply={onReply}
                onDeleteComment={onDeleteComment}
                onClose={showClose ? handleCloseComments : undefined}
                renderComment={renderComment}
            />
            {/* V4.0: 评论总结区域 - 仅乙方可见且有甲方真人评论时 */}
            {currentRole === 'PARTY_B' && hasHumanClientComments && (
                <div className="shrink-0 p-3 border-t border-zinc-800">
                    {feedbackSummary ? (
                        <FeedbackSummaryCard
                            summary={feedbackSummary}
                            isLoading={false}
                            onApply={onApplyAdjustments}
                            onDismiss={onDismissSummary}
                        />
                    ) : (
                        <button
                            onClick={onSummarizeComments}
                            disabled={isSummarizing}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isSummarizing
                                ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                }`}
                        >
                            {isSummarizing ? '正在分析...' : '📊 总结所有反馈'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // ===== 渲染通知横条（甲方视角 + 需求确认待查看）=====
    const renderNotificationBar = () => {
        if (currentRole !== 'PARTY_A' || !requirementConfirmPending) return null;

        return (
            <div className="w-full flex items-center justify-between px-5 py-3 bg-blue-600/15 border border-blue-500/30 rounded-xl shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                    <span className="text-sm text-blue-200 truncate">
                        乙方发起了项目的需求文档确认，请查看
                    </span>
                </div>
                <button
                    onClick={handleAcceptRequirementConfirm}
                    className="ml-4 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all bg-blue-600 text-white hover:bg-blue-500 shrink-0"
                >
                    查看需求文档
                </button>
            </div>
        );
    };

    // ==========================================
    // 移动端布局
    // ==========================================
    if (isMobile) {
        return (
            <div className="absolute inset-0 flex flex-col text-white font-sans overflow-hidden">
                {contextHolder}

                {/* Mobile Header (Dedicated Component) */}
                <MobileHeader
                    mobilePanel={mobilePanel}
                    handleBackToChat={handleBackToChat}
                    currentRole={currentRole}
                    setCurrentRole={setCurrentRole}
                    // agentEnabled & isAgentTyping handled inside MobileHeader via store or passed from here if we fetch from store
                    setIsConfigOpen={setIsConfigOpen}
                    documentVersions={documentVersions}
                    activeVersionIndex={visibleActiveIndex} // Use mapped index
                    onVersionSwitch={onVersionSwitch}
                    handleSendRequirementConfirmation={handleSendRequirementConfirmation}
                    requirementConfirmSent={requirementConfirmSent}
                    sidebarRef={sidebarRef}
                />

                {/* 通知横条 */}
                {renderNotificationBar()}

                {/* 内容区域（页面切换动画） */}
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {mobilePanel === 'chat' && (
                            <motion.div
                                key="mobile-chat"
                                initial={{ x: '-100%', opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '-100%', opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="absolute inset-0"
                            >
                                <AiAssistantSidebar
                                    ref={sidebarRef}
                                    currentRole={currentRole}
                                    onTriggerAiReview={handleAiAnalysisComplete}
                                    onWidgetClick={handleWidgetClick}
                                    onDocumentOpen={handleDocumentOpen}
                                    isSidebar={false}
                                />
                            </motion.div>
                        )}
                        {mobilePanel === 'document' && (
                            <motion.div
                                key="mobile-document"
                                initial={{ x: '100%', opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="absolute inset-0 bg-[#2C2C2C] rounded-xl overflow-hidden"
                            >
                                {renderDocumentView()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* BottomSheet 评论抽屉 (兼顾评论列表和新建评论输入) */}
                <BottomSheet
                    isOpen={commentSheetOpen}
                    onClose={() => {
                        setCommentSheetOpen(false);
                        setIsInputOpen(false); // Reset input state on close
                    }}
                    title={`评论 (${comments.length})`}
                    footer={
                        /* Footer: 输入框区域 */
                        <div className="p-3 bg-zinc-900 border-t border-zinc-800">
                            {isInputOpen ? (
                                // 展开状态：输入框 + 按钮
                                <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                    {selectedText && (
                                        <div className="text-xs text-zinc-400 border-l-2 border-yellow-500 pl-2 truncate">
                                            引用: &quot;{selectedText}&quot;
                                        </div>
                                    )}
                                    <textarea
                                        autoFocus
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-[16px] text-white resize-none focus:outline-none focus:border-blue-500 placeholder-zinc-500"
                                        rows={3}
                                        placeholder="写下你的想法..."
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onBlur={() => {
                                            // 可选：失去焦点时且无内容则收起？为了体验暂不自动收起，避免误触
                                        }}
                                    />
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setIsInputOpen(false)}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={() => {
                                                onSubmit();
                                                setIsInputOpen(false);
                                                // setCommentSheetOpen(false); // 保持面板打开，以便查看由自己发送的评论
                                            }}
                                            className={`px-5 py-2 rounded-lg text-sm font-medium text-white shadow-lg transition-colors ${inputValue.trim() ? 'bg-blue-600 hover:bg-blue-500' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                                                }`}
                                            disabled={!inputValue.trim()}
                                        >
                                            发布
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // 收起状态：伪输入框 (点击展开)
                                <div
                                    onClick={() => {
                                        setIsInputOpen(true);
                                        // 可以在这里触发震动反馈
                                    }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-full px-4 py-3 text-sm text-zinc-500 flex items-center gap-2 cursor-text active:scale-[0.99] transition-transform"
                                >
                                    <span className="text-zinc-400">✏️</span>
                                    <span>写下你的想法...</span>
                                </div>
                            )}
                        </div>
                    }
                >
                    {/* Body: 始终显示评论列表 */}
                    {renderCommentsPanel(false)}
                </BottomSheet>
            </div>
        );
    }

    // ==========================================
    // 桌面端布局
    // ==========================================

    const slideTransition = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

    return (
        <div className="absolute inset-4 flex flex-col text-white font-sans overflow-hidden gap-4">
            {contextHolder}

            {/* Desktop Header (Dedicated Component) */}
            <DesktopHeader
                currentRole={currentRole}
                setCurrentRole={setCurrentRole}
                // agentEnabled & isAgentTyping handled inside DesktopHeader via store
                setIsConfigOpen={setIsConfigOpen}
                sidebarRef={sidebarRef}
                onTriggerAiReview={handleAiReviewTrigger}
            />

            {/* 通知横条 */}
            {renderNotificationBar()}

            {/* 内容区域 */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

                {/* ===== 阶段一：纯聊天（居中） ===== */}
                {viewStage === 'chat' && (
                    <motion.div
                        key="chat-centered"
                        className="flex-1 flex justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="w-full max-w-3xl">
                            <AiAssistantSidebar
                                ref={sidebarRef}
                                currentRole={currentRole}
                                onTriggerAiReview={handleAiAnalysisComplete}
                                onWidgetClick={handleWidgetClick}
                                onDocumentOpen={handleDocumentOpen}
                                isSidebar={false}
                            />
                        </div>
                    </motion.div>
                )}

                {/* ===== 阶段二/三：多栏布局 ===== */}
                {viewStage !== 'chat' && (
                    <>
                        {/* 聊天栏（收窄） */}
                        <motion.div
                            key="chat-sidebar"
                            initial={{ width: '100%' }}
                            animate={{ width: '380px' }}
                            transition={slideTransition}
                            className="shrink-0 h-full"
                        >
                            <AiAssistantSidebar
                                ref={sidebarRef}
                                currentRole={currentRole}
                                onTriggerAiReview={handleAiAnalysisComplete}
                                onWidgetClick={handleWidgetClick}
                                onDocumentOpen={handleDocumentOpen}
                                isSidebar={true}
                            />
                        </motion.div>

                        {/* 文档区（从右滑入） */}
                        <motion.div
                            key="document-area"
                            className="flex-1 relative overflow-hidden min-w-0 bg-[#2C2C2C] rounded-xl"
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={slideTransition}
                        >
                            {renderDocumentView()}
                        </motion.div>

                        {/* 评论区（仅阶段三，从右滑入） */}
                        <AnimatePresence>
                            {viewStage === 'split_comments' && (
                                <motion.div
                                    key="comments-panel"
                                    className="w-[340px] shrink-0"
                                    initial={{ x: '100%', opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: '100%', opacity: 0 }}
                                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                                >
                                    {renderCommentsPanel(true)}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </div>
    );
}
