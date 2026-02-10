import React, { useState } from 'react';

// ============================================
// Priority Config
// ============================================
const PRIORITY_CONFIG = {
    high: { label: '高优先级', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
    medium: { label: '中优先级', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
    low: { label: '低优先级', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-400' },
};

const SEVERITY_DOT = {
    high: 'bg-red-400',
    medium: 'bg-amber-400',
    low: 'bg-green-400',
};

// ============================================
// FeedbackSummaryCard Component
// ============================================
export default function FeedbackSummaryCard({ summary, isLoading, onApply, onDismiss }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Loading State
    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 mb-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 rounded-full bg-zinc-700"></div>
                    <div className="h-4 bg-zinc-700 rounded w-32"></div>
                    <div className="ml-auto h-3 bg-zinc-700 rounded w-16"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-3 bg-zinc-700 rounded w-full"></div>
                    <div className="h-3 bg-zinc-700 rounded w-3/4"></div>
                    <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
                </div>
                <div className="mt-3 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></span>
                    AI 正在分析甲方评论...
                </div>
            </div>
        );
    }

    // No data
    if (!summary) return null;

    const priorityConfig = PRIORITY_CONFIG[summary.priority] || PRIORITY_CONFIG.medium;

    return (
        <div className={`bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 border ${priorityConfig.border} rounded-xl mb-4 overflow-hidden transition-all duration-300`}>
            {/* Header - Always Visible */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-base">📊</span>
                    <span className="font-semibold text-sm text-zinc-100">甲方反馈总结</span>
                    <span className="text-xs text-zinc-500">{summary.total_count} 条评论</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityConfig.bg} ${priorityConfig.color} font-medium`}>
                        {priorityConfig.label}
                    </span>
                    <svg
                        className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Body - Collapsible */}
            {!isCollapsed && (
                <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Themes Section */}
                    {summary.themes && summary.themes.length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">主题分类</span>
                            {summary.themes.map((theme, idx) => (
                                <div key={idx} className="flex items-start gap-2 bg-zinc-800/50 rounded-lg p-2.5">
                                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[theme.severity] || SEVERITY_DOT.medium}`}></span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-zinc-200">{theme.theme}</span>
                                            <span className="text-[10px] text-zinc-500">({theme.count}条)</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{theme.summary}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Items */}
                    {summary.action_items && summary.action_items.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">建议行动</span>
                            {summary.action_items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                                    <span className="text-zinc-600 font-mono text-[10px] shrink-0">{idx + 1}.</span>
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                        <button
                            onClick={(e) => { e.stopPropagation(); onApply?.(summary); }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98]"
                        >
                            <span>✨</span>
                            应用调整
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-lg transition-all active:scale-[0.98]"
                        >
                            忽略
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
