import { useState, useRef, useEffect, useCallback } from 'react';
import ThinkingOverlay from './ThinkingOverlay';

// ============================================
// Helper: Highlighter Component (Multi-match support)
// ============================================
const Highlighter = ({ text, blockId, comments = [], activeId }) => {
    if (!text) return null;

    // 1. Find all relevant quotes for this block
    const matches = [];
    comments.forEach(c => {
        // Safe check for anchor existence
        if (c.anchor?.blockId === blockId && c.anchor?.quote) {
            const quote = c.anchor.quote.trim(); // Normalize quote
            if (!quote) return;

            // Debug active state matching
            // Check against both ID and targetId for flexibility
            const isTargetMatch = c.targetId && c.targetId === activeId;
            const isIdMatch = c.id === activeId;
            const isActive = isIdMatch || isTargetMatch;

            // Find all instances of the quote in the text
            // Use case-insensitive matching for better UX
            const textLower = text.toLowerCase();
            const quoteLower = quote.toLowerCase();

            let startIndex = 0;
            let index;
            while ((index = textLower.indexOf(quoteLower, startIndex)) > -1) {
                // Verify original case matches if strictness required? 
                // For now, let's assume loose matching is better for demo.
                matches.push({
                    start: index,
                    end: index + quote.length,
                    isActive,
                    commentId: c.id
                });
                startIndex = index + 1;
            }
        }
    });

    // If no matches, return raw text
    if (matches.length === 0) return <>{text}</>;

    // 2. Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    // 3. Render matched segments
    const result = [];
    let currentIdx = 0;

    // Simple non-overlapping strategy: take the first match that starts after currentIdx
    for (const match of matches) {
        if (match.start < currentIdx) continue; // Skip overlapping for simple implementation

        // Text before match
        if (match.start > currentIdx) {
            result.push(<span key={`text-${currentIdx}`}>{text.slice(currentIdx, match.start)}</span>);
        }

        // The Highlighted Segment
        const style = match.isActive ? {
            backgroundColor: '#fef08a',
            borderBottom: '2px solid #ca8a04',
            transition: 'all 0.2s',
            cursor: 'pointer'
        } : {
            backgroundColor: '#fef9c3', // Light yellow for inactive
            borderBottom: '2px solid transparent',
            transition: 'all 0.2s',
            cursor: 'pointer'
        };

        result.push(
            <span
                key={`match-${match.start}`}
                style={style}
                onClick={(e) => {
                    e.stopPropagation();
                    // Scroll to comment handled by parent? 
                    // Or just visual indication.
                }}
            >
                {text.slice(match.start, match.end)}
            </span>
        );

        currentIdx = match.end;
    }

    // Remaining text
    if (currentIdx < text.length) {
        result.push(<span key={`text-end`}>{text.slice(currentIdx)}</span>);
    }

    return <>{result}</>;
};



// ============================================
// Main Component: MockSplitView
// ============================================
const MockSplitView = ({ activeId, onSelectElement, onTextSelect, isFallbackActive, isLegacyMode, isThinking, isReviewing, comments = [] }) => {

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
            console.log('[MockSplitView] Selected text:', text, 'in Block:', blockEl.id);
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
            className="flex flex-col h-full w-full bg-[#1e1e1e] text-white font-sans overflow-hidden relative"
            onMouseUp={handleMouseUp} // Global capture within this view
        >
            {/* The Thinking Overlay - Syncs with isReviewing */}
            <ThinkingOverlay isVisible={isReviewing || isThinking} />


            {/* Top Panel: Prototype */}
            <div style={{ height: '40%' }} className="overflow-y-auto border-b-2 border-[#333] relative">
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
                            className="card"
                            id="ui-price-card" // Keep legacy ID for UI click
                            style={activeId === 'ui-price-card' ? { ...uiHighlightStyle } : {}}
                            onClick={() => onSelectElement && onSelectElement('ui-price-card', 'SAAS 团队版')}
                        >
                            <h3 id="block-card-team-title">SAAS 团队版</h3>
                            <div className="price" id="block-card-team-price">
                                <Highlighter text="25积分" blockId="block-card-team-price" comments={comments} activeId={activeId} />
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
                                <Highlighter text="50积分" blockId="block-card-ent-price" comments={comments} activeId={activeId} />
                                <span className="price-suffix">/次</span>
                            </div>
                            <div style={{ margin: '10px 0' }}>
                                <span className="tag">UI生成</span> <span className="tag">私有化部署</span>
                            </div>
                            <button
                                className="btn"
                                id="ui-upgrade-btn"
                                onClick={() => onSelectElement && onSelectElement('ui-upgrade-btn', 'SAAS 企业版')}
                                style={activeId === 'ui-upgrade-btn' ? { ...uiHighlightStyle } : {}}
                            >
                                立即升级
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Panel: Document with Semantic Blocks */}
            <div style={{ height: '60%' }} className="overflow-y-auto p-6 bg-[#09090b]">
                <div className="max-w-3xl mx-auto text-[#d4d4d8] text-sm leading-relaxed space-y-6">
                    <h1 id="block-doc-title" className="text-xl font-bold text-white mb-6 border-b border-[#27272a] pb-4">
                        <Highlighter text="关于 AI 企业积分对白名单客户收费调整的公告" blockId="block-doc-title" comments={comments} activeId={activeId} />
                    </h1>

                    <div className="space-y-4">
                        <p id="block-doc-intro-1">
                            <Highlighter text="尊敬的 MasterGo AI 用户，您好！" blockId="block-doc-intro-1" comments={comments} activeId={activeId} />
                        </p>
                        <p id="block-doc-intro-2">
                            <Highlighter
                                text="非常感谢您一直以来对我们服务的信任与支持。随着 AI 技术的不断提升，为了持续为您提供更优质、稳定且富有创新性的 AI 快搭和 AI 设计助手应用服务，我们将对 AI 企业积分收费策略由免费试用正式进入付费商用。"
                                blockId="block-doc-intro-2"
                                comments={comments}
                                activeId={activeId}
                            />
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-1-title" className="text-lg font-semibold text-white mt-4">一、调整原因</h2>
                        <p id="block-section-1-text" className="text-[#a1a1aa]">
                            <Highlighter
                                text="为了进一步加大在 AI 快搭和 AI 设计助手技术研发上的投入，提升输出物的准确性、优化模型的性能，确保您能获得行业领先的 AI 服务体验。经过全面评估与慎重考虑，我们决定对白名单客户的 AI 企业积分收费进行调整。"
                                blockId="block-section-1-text"
                                comments={comments}
                                activeId={activeId}
                            />
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-2-title" className="text-lg font-semibold text-white mt-4">二、调整内容</h2>
                        <p id="block-section-2-intro">
                            <Highlighter
                                text="自 2026 年 2 月 26 日起，AI 企业积分将正式从免费试用模式转变为基于应用场景的收费模式，具体收费规则如下："
                                blockId="block-section-2-intro"
                                comments={comments}
                                activeId={activeId}
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
                                                    <Highlighter text="0分/次 | 0分/次" blockId="block-rule-perf-val" comments={comments} activeId={activeId} />
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
                                        text="在 2026 年 1 月 26 日至 2026 年 2 月 25 日期间，您仍可免费使用 AI 快搭和 AI 设计助手。"
                                        blockId="block-section-3-item-1"
                                        comments={comments}
                                        activeId={activeId}
                                    />
                                </span>
                            </li>
                            <li>
                                <strong className="text-white">历史积分保护</strong>：
                                <span id="block-section-3-item-2">
                                    <Highlighter
                                        text="对于在调整生效前已购买且尚未使用完的 AI 积分，不影响您的正常使用。"
                                        blockId="block-section-3-item-2"
                                        comments={comments}
                                        activeId={activeId}
                                    />
                                </span>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h2 id="block-section-4-title" className="text-lg font-semibold text-white mt-4">四、如何获取积分</h2>
                        <p id="block-section-4-text">
                            <Highlighter
                                text="若您希望持续使用 AI 快搭和 AI 设计助手产品，可购买 AI 企业积分套餐。具体信息，您可以联系客户经理，获取专属折扣优惠。"
                                blockId="block-section-4-text"
                                comments={comments}
                                activeId={activeId}
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

export default MockSplitView;
