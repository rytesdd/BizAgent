import React, { useState } from 'react';

// ============================================
// DiffPreviewPanel Component
// Shows a preview of document patches before applying
// ============================================
export default function DiffPreviewPanel({ patches, isLoading, onConfirm, onCancel }) {
    // Track individual patch selection (all selected by default)
    const [selectedPatches, setSelectedPatches] = useState(() =>
        new Set(patches?.map((_, idx) => idx) || [])
    );

    // Loading state - generating patches
    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
                            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                            <div className="absolute inset-2 rounded-full border-2 border-blue-400 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-zinc-100">AI 正在生成文档修改建议...</p>
                            <p className="text-xs text-zinc-500 mt-1">根据甲方反馈分析文档内容</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // No patches
    if (!patches || patches.length === 0) return null;

    const togglePatch = (idx) => {
        setSelectedPatches(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedPatches.size === patches.length) {
            setSelectedPatches(new Set());
        } else {
            setSelectedPatches(new Set(patches.map((_, idx) => idx)));
        }
    };

    const handleConfirm = () => {
        const selected = patches.filter((_, idx) => selectedPatches.has(idx));
        onConfirm?.(selected);
    };

    const getActionLabel = (action) => {
        switch (action) {
            case 'modify': return '修改';
            case 'insert_after': return '插入';
            case 'delete': return '删除';
            default: return action;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'modify': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            case 'insert_after': return 'bg-green-500/15 text-green-400 border-green-500/30';
            case 'delete': return 'bg-red-500/15 text-red-400 border-red-500/30';
            default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">📝</span>
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-100">文档调整预览</h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                {patches.length} 处修改 · 已选 {selectedPatches.size} 处
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleAll}
                        className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-500/10"
                    >
                        {selectedPatches.size === patches.length ? '取消全选' : '全选'}
                    </button>
                </div>

                {/* Patch List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {patches.map((patch, idx) => {
                        const isSelected = selectedPatches.has(idx);
                        return (
                            <div
                                key={idx}
                                className={`rounded-xl border transition-all duration-200 overflow-hidden ${isSelected
                                    ? 'border-zinc-600 bg-zinc-800/50'
                                    : 'border-zinc-800 bg-zinc-900/50 opacity-60'
                                    }`}
                            >
                                {/* Patch Header - checkbox + reason title */}
                                <div
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-700/20 transition-colors"
                                    onClick={() => togglePatch(idx)}
                                >
                                    {/* Checkbox */}
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-zinc-600 hover:border-zinc-400'
                                        }`}>
                                        {isSelected && (
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Index */}
                                    <span className="text-xs text-zinc-500 font-mono shrink-0">
                                        #{idx + 1}
                                    </span>

                                    {/* Reason as title */}
                                    <span className="text-xs text-zinc-200 font-medium truncate flex-1">
                                        {patch.reason || '文档修改'}
                                    </span>

                                    {/* Action Badge */}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${getActionColor(patch.action)}`}>
                                        {getActionLabel(patch.action)}
                                    </span>
                                </div>

                                {/* Diff Content - 始终展开显示 */}
                                <div className="px-4 pb-4 space-y-2">
                                    {/* Block ID as auxiliary info */}
                                    <div className="text-[10px] text-zinc-600 font-mono pl-1">
                                        📍 {patch.block_id}
                                    </div>

                                    {/* Original Text (Red - Deletion) */}
                                    {patch.original_text && (
                                        <div className="flex gap-2">
                                            <span className="text-red-400 font-mono text-xs shrink-0 mt-0.5 select-none">−</span>
                                            <div className="flex-1 text-xs text-red-300/80 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2 leading-relaxed line-through decoration-red-500/40">
                                                {patch.original_text}
                                            </div>
                                        </div>
                                    )}

                                    {/* New Text (Green - Addition) */}
                                    {patch.new_text && (
                                        <div className="flex gap-2">
                                            <span className="text-green-400 font-mono text-xs shrink-0 mt-0.5 select-none">+</span>
                                            <div className="flex-1 text-xs text-green-300/90 bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2 leading-relaxed font-medium">
                                                {patch.new_text}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
                    <p className="text-[11px] text-zinc-500">
                        选中的修改将应用到文档
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-medium rounded-lg transition-all active:scale-[0.98]"
                        >
                            ↩ 取消
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedPatches.size === 0}
                            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.98] ${selectedPatches.size > 0
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                }`}
                        >
                            ✅ 应用 {selectedPatches.size > 0 ? `${selectedPatches.size} 处修改` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
