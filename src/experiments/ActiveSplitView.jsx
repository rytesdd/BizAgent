import { useState, useRef, useEffect, useCallback } from 'react';

import { getDocText } from '../data/documentModel';
import PrototypePreview from '../components/PrototypePreview';

// ============================================
// Helper: Highlighter Component (Multi-match support)
// ============================================
import Highlighter from '../components/shared/Highlighter';

// ============================================
// Main Component: ActiveSplitView (Fork of MockSplitView for dynamic use)
// ============================================
const ActiveSplitView = ({
    activeCommentId,
    activeUiId,
    onSelectElement,
    onTextSelect,
    isFallbackActive,
    isLegacyMode,
    isThinking,
    isReviewing,
    comments = [],
    getDocTextOverride,
    isPrototypeMode = false, // Toggle mode
    prdText = "", // PRD Text for generation
    onPrototypeClose, // Callback to close prototype modeg prototype
}) => {
    // V2 passes a dynamic getDocText from state; V1 uses the static import
    const resolveDocText = getDocTextOverride || getDocText;

    // --- Selection Handler ---
    const handleMouseUp = useCallback((e) => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (!text) return;

        // Find closest parent with an ID (Block ID)
        let node = selection.anchorNode;
        // Text nodes don't have IDs, iterate up
        while (node && node.nodeType === 3) {
            node = node.parentNode;
        }

        // Find the "Block" element (has 'block-' prefix or generic ID)
        let blockEl = node;
        while (blockEl && (!blockEl.id || !blockEl.id.startsWith('block-'))) {
            if (blockEl.classList && blockEl.classList.contains('demo-container')) break; // Stop at container
            blockEl = blockEl.parentElement;
        }

        if (blockEl && blockEl.id) {
            // Found a block!
            console.log('[ActiveSplitView] Selected text:', text, 'in Block:', blockEl.id);
            if (onTextSelect) {
                onTextSelect({
                    blockId: blockEl.id,
                    text: text,
                    rect: selection.getRangeAt(0).getBoundingClientRect() // Pass rect for positioning
                });
            }
        }
    }, [onTextSelect]);

    // UI Highlight Style
    const uiHighlightStyle = {
        border: '2px solid #faad14',
        boxShadow: '0 0 15px rgba(255, 77, 79, 0.6)',
        transform: 'scale(1.02)',
        zIndex: 10,
        position: 'relative',
        transition: 'all 0.3s ease'
    };

    return (
        <div
            className="flex flex-col h-full w-full bg-transparent text-white font-sans overflow-hidden relative gap-4"
            onMouseUp={handleMouseUp} // Global capture within this view
        >

            {/* Top Panel: Prototype */}
            <div className="h-[40%] bg-[#1e1e1e] relative shrink-0 rounded-xl overflow-hidden border-b border-[#333]">
                {isPrototypeMode ? (
                    // Render Injected Component (e.g. AI Generated Prototype)
                    <div className="h-full w-full relative">
                        {/* We need to pass onClose? maybe not, mode is controlled by parent */}
                        <PrototypePreview
                            prdText={prdText}
                            onClose={onPrototypeClose || (() => { })}
                        />
                    </div>
                ) : (
                    // Render Default Mock
                    <div className="h-full overflow-y-auto">
                        <style>{`
                            .demo-container { background: #1e1e1e; color: white; padding: 20px; font-family: sans-serif; height: 100%; box-sizing: border-box; font-size: 14px !important; }
                            .demo-container * { font-size: inherit; }
                            .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
                            .card { border: 1px solid #333; border-radius: 8px; padding: 20px; background: #252525; transition: all 0.2s; cursor: pointer; }
                            .card:hover { border-color: #3b82f6; background: #2a2a2a; transform: translateY(-2px); }
                            .demo-container h2 { color: white; font-size: 18px !important; margin: 0; font-weight: bold; }
                            .card h3 { color: #9ca3af; font-size: 14px !important; margin: 0; }
                            .price { font-size: 24px !important; font-weight: bold; margin: 10px 0; color: white; }
                            .tag { background: #374151; color: #d1d5db; padding: 2px 6px; border-radius: 4px; font-size: 10px !important; margin-right: 5px; }
                            .btn { display: block; width: 100%; padding: 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; margin-top: 15px; cursor: pointer; font-size: 14px !important; }
                            .status-dot { color: #4ade80; font-size: 12px !important; }
                        `}</style>
                        <div className="demo-container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h2 id="block-proto-title">MasterGo AI 计费方案预览</h2>
                                </div>
                                <span className="status-dot">● 交互原型已就绪</span>
                            </div>
                            <div className="pricing-grid">
                                <div
                                    className="card cursor-pointer"
                                    id="ui-price-card"
                                    style={activeUiId === 'ui-price-card' ? { ...uiHighlightStyle } : {}}
                                    onClick={(e) => { e.stopPropagation(); onSelectElement?.('ui-price-card'); }}
                                >
                                    <h3 id="block-card-team-title">SAAS 团队版</h3>
                                    <div className="price" id="block-card-team-price">
                                        <Highlighter text="25积分" blockId="block-card-team-price" comments={comments} activeCommentId={activeCommentId} onElementClick={onSelectElement} />
                                        <span className="price-suffix">/次</span>
                                    </div>
                                    <div style={{ margin: '10px 0' }}>
                                        <span className="tag">生成页面</span> <span className="tag">极速模式</span>
                                    </div>
                                    <button className="btn">选择方案</button>
                                </div>
                                <div className="card" style={{ borderColor: '#3b82f6' }}>
                                    <h3 id="block-card-ent-title">SAAS 企业版 (推荐)</h3>
                                    <div className="price" id="block-card-ent-price">
                                        <Highlighter text="50积分" blockId="block-card-ent-price" comments={comments} activeCommentId={activeCommentId} onElementClick={onSelectElement} />
                                        <span className="price-suffix">/次</span>
                                    </div>
                                    <div style={{ margin: '10px 0' }}>
                                        <span className="tag">UI生成</span> <span className="tag">私有化部署</span>
                                    </div>
                                    <button
                                        className="btn cursor-pointer"
                                        id="ui-upgrade-btn"
                                        onClick={(e) => { e.stopPropagation(); onSelectElement?.('ui-upgrade-btn'); }}
                                        style={activeUiId === 'ui-upgrade-btn' ? { ...uiHighlightStyle } : {}}
                                    >
                                        立即升级
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Panel: Document with Semantic Blocks */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#101010] rounded-xl overflow-hidden">
                <div className="max-w-3xl mx-auto text-[#d4d4d8] text-sm leading-relaxed space-y-6">
                    <h1 id="block-doc-title" className="text-xl font-bold text-white mb-6 border-b border-[#27272a] pb-4">
                        <Highlighter text={resolveDocText("block-doc-title")} blockId="block-doc-title" comments={comments} activeCommentId={activeCommentId} onElementClick={onSelectElement} />
                    </h1>

                    <div className="space-y-4">
                        <p id="block-doc-intro-1">
                            <Highlighter text={resolveDocText("block-doc-intro-1")} blockId="block-doc-intro-1" comments={comments} activeCommentId={activeCommentId} onElementClick={onSelectElement} />
                        </p>
                        <p id="block-doc-intro-2">
                            <Highlighter
                                text={resolveDocText("block-doc-intro-2")}
                                blockId="block-doc-intro-2"
                                comments={comments}
                                activeCommentId={activeCommentId}
                                onElementClick={onSelectElement}
                            />
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-1-title" className="text-lg font-semibold text-white mt-4">一、调整原因</h2>
                        <p id="block-section-1-text" className="text-[#a1a1aa]">
                            <Highlighter
                                text={resolveDocText("block-section-1-text")}
                                blockId="block-section-1-text"
                                comments={comments}
                                activeCommentId={activeCommentId}
                                onElementClick={onSelectElement}
                            />
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-2-title" className="text-lg font-semibold text-white mt-4">二、调整内容</h2>
                        <p id="block-section-2-intro">
                            <Highlighter
                                text={resolveDocText("block-section-2-intro")}
                                blockId="block-section-2-intro"
                                comments={comments}
                                activeCommentId={activeCommentId}
                                onElementClick={onSelectElement}
                            />
                        </p>

                        <div className="space-y-4 pl-4 border-l-2 border-[#27272a] mt-4">
                            <h3 id="block-rule-1-title" className="text-base font-medium text-white">
                                （一）AI 快搭收费规则（积分/次）
                            </h3>
                            {/* Table simplified as static for now, or could make cells blocks */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-[#27272a] text-[#a1a1aa]">
                                            <th className="py-2">能力</th><th className="py-2">操作</th><th className="py-2">SAAS 团队版</th><th className="py-2">SAAS 企业版</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#27272a]">
                                        <tr><td className="py-2">大匠</td><td className="py-2">生成页面</td><td className="py-2">25分/次</td><td className="py-2">25分/次</td></tr>
                                        <tr><td className="py-2">小匠</td><td className="py-2">生成页面</td><td className="py-2">5分/次</td><td className="py-2">15分/次</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <h3 id="block-rule-2-title" className="text-base font-medium text-white mt-6">（二）AI 设计助手收费规则（积分/次）</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <tbody className="divide-y divide-[#27272a]">
                                        <tr>
                                            <td className="py-2">性能优化</td>
                                            <td className="py-2" colSpan="2">
                                                <span id="block-rule-perf-val">
                                                    <Highlighter text={resolveDocText("block-rule-perf-val")} blockId="block-rule-perf-val" comments={comments} activeCommentId={activeCommentId} onElementClick={onSelectElement} />
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-3-title" className="text-lg font-semibold text-white mt-4">三、重要的过渡期安排</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong className="text-white">免费缓冲期</strong>：
                                <span id="block-section-3-item-1">
                                    <Highlighter
                                        text={resolveDocText("block-section-3-item-1")}
                                        blockId="block-section-3-item-1"
                                        comments={comments}
                                        activeCommentId={activeCommentId}
                                        onElementClick={onSelectElement}
                                    />
                                </span>
                            </li>
                            <li>
                                <strong className="text-white">历史积分保护</strong>：
                                <span id="block-section-3-item-2">
                                    <Highlighter
                                        text={resolveDocText("block-section-3-item-2")}
                                        blockId="block-section-3-item-2"
                                        comments={comments}
                                        activeCommentId={activeCommentId}
                                        onElementClick={onSelectElement}
                                    />
                                </span>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-4-title" className="text-lg font-semibold text-white mt-4">四、如何获取积分</h2>
                        <p id="block-section-4-text">
                            <Highlighter
                                text={resolveDocText("block-section-4-text")}
                                blockId="block-section-4-text"
                                comments={comments}
                                activeCommentId={activeCommentId}
                                onElementClick={onSelectElement}
                            />
                        </p>
                    </div>

                    <div className="pt-8 text-[#a1a1aa] text-right text-xs">
                        <p id="block-footer-team">MasterGo 产品团队</p>
                        <p id="block-footer-date">2026 年 1 月 26 日</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActiveSplitView;
