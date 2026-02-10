import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMediaQuery from '../hooks/useMediaQuery';
import AiAssistantSidebar from './AiAssistantSidebar';
import MockSplitView from '../MockSplitView';
import CommentsPanel from './CommentsPanel';
import BottomSheet from './BottomSheet';
import AgentProcessCycle from './AgentProcessCycle';
import { IconAI, IconMenu, IconSend } from '../svg-icons';

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
    agentEnabled,
    vendorConfig,
    isAgentTyping,

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
    setIsAgentTyping,

    // === 评论卡片渲染函数 (由 DualRoleView 传入) ===
    renderComment,
}) {
    const isMobile = useMediaQuery('(max-width: 767px)');

    // ===== 渐进式展开状态 =====
    const [viewStage, setViewStage] = useState('chat');
    const [mobilePanel, setMobilePanel] = useState('chat');
    const [commentSheetOpen, setCommentSheetOpen] = useState(false);

    // ===== 状态转换回调 =====

    // 文档卡片点击 → 展开文档区
    const handleDocumentOpen = useCallback(() => {
        if (isMobile) {
            setMobilePanel('document');
        }
        setViewStage('split');
    }, [isMobile]);

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
    }, [isMobile, onElementClick]);

    // 评论区关闭
    const handleCloseComments = useCallback(() => {
        if (isMobile) {
            setCommentSheetOpen(false);
        } else {
            setViewStage('split');
        }
    }, [isMobile]);

    // 移动端返回聊天
    const handleBackToChat = useCallback(() => {
        setMobilePanel('chat');
        setViewStage('chat');
    }, []);

    // 桌面端关闭文档区 → 回到纯聊天
    const handleCloseDocument = useCallback(() => {
        setViewStage('chat');
    }, []);

    // 评论卡片点击（包装原回调，移动端需要切换到文档视图）
    const handleCommentClickWrapped = useCallback((id, blockId) => {
        onCommentClick?.(id, blockId);

        // 移动端：如果在聊天视图，需要先切到文档
        if (isMobile && mobilePanel === 'chat') {
            setMobilePanel('document');
            setViewStage('split');
        }
    }, [isMobile, mobilePanel, onCommentClick]);

    // Widget 点击回调（拦截 gateway 类型触发文档展开）
    const handleWidgetClick = useCallback((type, data) => {
        if (type === 'gateway') {
            handleDocumentOpen();
        }
    }, [handleDocumentOpen]);

    // ===== 渲染 Header =====
    const renderHeader = () => (
        <div className="h-14 w-full flex items-center justify-between px-5 bg-zinc-900 rounded-xl shrink-0">
            <div className="flex items-center gap-3">
                {/* 移动端在文档视图时显示返回按钮 */}
                {isMobile && mobilePanel === 'document' && (
                    <button
                        onClick={handleBackToChat}
                        className="text-zinc-400 hover:text-white transition-colors mr-1"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                )}

                <span className="font-bold text-base text-zinc-100">
                    {isMobile && mobilePanel === 'document' ? '文档预览' : 'BizAgent'}
                </span>

                {/* 角色切换 - 仅在聊天视图或桌面端显示 */}
                {(!isMobile || mobilePanel === 'chat') && (
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
                )}
            </div>

            <div className="flex items-center gap-2">
                {/* Agent 控制 - 仅乙方 */}
                {currentRole === 'PARTY_A' ? (
                    <button
                        onClick={handleAiReviewTrigger}
                        style={{ display: 'none' }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-white text-black hover:bg-zinc-200 shadow-sm"
                    >
                        <IconAI className="w-3.5 h-3.5" />
                        AI Review
                    </button>
                ) : (
                    <div className="flex items-center gap-3 bg-zinc-800 rounded-full px-3 py-1 text-xs">
                        {isAgentTyping && (
                            <AgentProcessCycle onComplete={() => setIsAgentTyping(false)} />
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">启用Agent自动回复</span>
                            <button
                                onClick={() => setAgentEnabled(!agentEnabled)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${agentEnabled ? 'bg-green-500' : 'bg-zinc-600'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${agentEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setIsConfigOpen(true)}
                    className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                >
                    <IconMenu className="w-5 h-5" />
                </button>
            </div>
        </div>
    );

    // ===== 渲染浮动工具栏（评论输入） =====
    const renderToolbar = () => {
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
            {/* 文档区头部（桌面端带关闭按钮） */}
            {!isMobile && (
                <div className="h-11 flex items-center justify-between px-4 bg-zinc-900/80 shrink-0 border-b border-zinc-800/50">
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
        <CommentsPanel
            comments={comments}
            activeId={activeId}
            onCommentClick={handleCommentClickWrapped}
            onReply={onReply}
            onDeleteComment={onDeleteComment}
            onClose={showClose ? handleCloseComments : undefined}
            renderComment={renderComment}
        />
    );

    // ==========================================
    // 移动端布局
    // ==========================================
    if (isMobile) {
        return (
            <div className="absolute inset-0 flex flex-col text-white font-sans overflow-hidden">
                {/* Header */}
                {renderHeader()}

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

                {/* BottomSheet 评论抽屉 */}
                <BottomSheet
                    isOpen={commentSheetOpen}
                    onClose={() => setCommentSheetOpen(false)}
                    title={`评论 (${comments.length})`}
                >
                    {renderCommentsPanel(false)}
                </BottomSheet>
            </div>
        );
    }

    // ==========================================
    // 桌面端布局
    // ==========================================

    // 动画配置
    const slideTransition = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

    return (
        <div className="absolute inset-4 flex flex-col text-white font-sans overflow-hidden gap-4">
            {/* Header */}
            {renderHeader()}

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
