import React from 'react';

/**
 * CommentsPanel - 评论列表面板
 *
 * 从 DualRoleView 中提取的评论列表逻辑，
 * 增加了顶部关闭按钮（用于 Web 端三栏 → 二栏收起）。
 *
 * 注意：CommentCard 组件仍在 DualRoleView.jsx 中定义，
 * 通过 renderComment prop 透传渲染。
 */
export default function CommentsPanel({
    comments = [],
    activeId,
    onCommentClick,
    onReply,
    onDeleteComment,
    onClose,
    renderComment, // 由父组件传入 CommentCard 渲染函数
}) {
    return (
        <div className="h-full flex flex-col bg-zinc-900 rounded-xl overflow-hidden">
            {/* 顶部标题栏（带关闭按钮） */}
            <div className="h-14 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
                <span className="font-medium text-zinc-100">
                    评论 ({comments.length})
                </span>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                        title="收起评论区"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>

            {/* 评论列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comments.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8">
                        暂无评论
                    </div>
                ) : (
                    comments.map(c => (
                        renderComment
                            ? renderComment(c)
                            : (
                                <div
                                    key={c.id}
                                    id={`comment-${c.id}`}
                                    onClick={() => onCommentClick?.(c.id, c.anchor?.blockId)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all ${activeId === c.id ? 'bg-[#2C2C2C]' : 'bg-[#2C2C2C] hover:bg-[#333333]'}`}
                                >
                                    <div className="text-sm text-zinc-200">{c.content}</div>
                                </div>
                            )
                    ))
                )}
            </div>
        </div>
    );
}
