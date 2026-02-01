import React, { useState, useCallback, useRef, useEffect } from 'react';
import MockSplitView from './MockSplitView';
import { IconSend, IconPlus } from './svg-icons'; // Assuming these exist, or I can mock icons

// ==========================================
// 1. CLEAN DATA (Feishu Style)
// ==========================================
const SEED_COMMENTS = [
    {
        id: "demo_001",
        user: "产品经理",
        content: "价格字体太小了，建议调大。",
        anchor: { blockId: "block-card-team-price", quote: "25积分" },
        created_at: Date.now() - 100000
    },
    {
        id: "demo_002",
        user: "法务",
        content: "这里必须明确年份，避免歧义。",
        anchor: { blockId: "block-section-3-item-1", quote: "2026 年 1 月 26 日" },
        created_at: Date.now() - 80000
    },
    {
        id: "demo_003",
        user: "CTO",
        content: "性能指标需要更具体，比如 P99。",
        anchor: { blockId: "block-rule-perf-val", quote: "0分/次" },
        created_at: Date.now() - 60000
    }
];

export default function StrictFeishuDemo() {
    // --- State ---
    const [comments, setComments] = useState(SEED_COMMENTS);
    const [activeId, setActiveId] = useState(null);

    // Selection / Toolbar State
    const [selectedText, setSelectedText] = useState('');
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [toolbarPosition, setToolbarPosition] = useState(null); // { top, left }
    const [isInputOpen, setIsInputOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const scrollContainerRef = useRef(null);

    // --- Handlers ---

    // 1. Handle Selection from MockSplitView
    const handleTextSelect = useCallback(({ blockId, text, rect }) => {
        if (!text) {
            // Close things if clicked blank
            setToolbarPosition(null);
            setIsInputOpen(false);
            return;
        }

        console.log('[Demo] Text Selected:', text, 'Block:', blockId);

        setSelectedText(text);
        setSelectedBlockId(blockId);

        // Calculate Position relative to container
        // Note: MockSplitView is likely full width/height, so rect is viewport based?
        // Let's assume passed rect is Viewport based. 
        // We need to position fixed or absolute. Let's use Fixed for simplicity in Demo.
        setToolbarPosition({
            top: rect.bottom + 10,
            left: rect.left
        });
        setIsInputOpen(false); // Reset to just button first
    }, []);

    // 2. Open Input
    const handleOpenInput = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsInputOpen(true);
    };

    // 3. Submit Comment
    const handleSubmit = () => {
        if (!inputValue.trim()) return;

        const newComment = {
            id: `new_${Date.now()}`,
            user: "我 (Demo)",
            content: inputValue,
            anchor: {
                blockId: selectedBlockId,
                quote: selectedText
            },
            created_at: Date.now()
        };

        setComments(prev => [...prev, newComment]);

        // Reset/Close
        setInputValue('');
        setIsInputOpen(false);
        setToolbarPosition(null);
        setSelectedText('');
        setActiveId(newComment.id); // Auto activate
    };

    // 4. Handle Click Comment in Sidebar
    const handleCommentClick = (id, blockId) => {
        setActiveId(id);
        // Try to scroll into view
        // Ideally we would emit an event or expose ref, but for now just highlight
        // Simple hack: find element by blockId and scroll
        if (blockId) {
            const el = document.getElementById(blockId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    return (
        <div className="flex h-screen w-screen bg-black text-white font-sans overflow-hidden">
            {/* --- Left: Document View --- */}
            <div className="flex-1 relative flex flex-col border-r border-zinc-800">
                <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900">
                    <span className="font-bold text-lg">📄 Feishu/Docs Anchoring Demo (Sandbox)</span>
                    <span className="ml-4 text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Pure Environment</span>
                </div>

                {/* Scroll Container for Document */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Reuse MockSplitView - IT MUST TAKE 100% HEIGHT */}
                    <div className="h-full w-full overflow-y-auto" ref={scrollContainerRef}>
                        <MockSplitView
                            activeId={activeId}
                            comments={comments}
                            onTextSelect={handleTextSelect}
                            // Pass dummies for others
                            activeSection={null}
                            onSelectElement={() => { }}
                            isLegacyMode={false}
                            isFallbackActive={false}
                            isThinking={false}
                            isReviewing={false} // No AI overlay for now to keep it clean
                        />
                    </div>
                </div>

                {/* --- Floating Toolbar / Input (Fixed Layer) --- */}
                {toolbarPosition && (
                    <div
                        style={{
                            position: 'fixed',
                            top: toolbarPosition.top,
                            left: toolbarPosition.left,
                            zIndex: 9999
                        }}
                        className="animate-in fade-in zoom-in duration-200"
                    >
                        {!isInputOpen ? (
                            <button
                                onClick={handleOpenInput}
                                onMouseDown={e => e.preventDefault()} // Prevent losing selection
                                className="bg-zinc-800 border border-zinc-600 shadow-xl text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 hover:border-blue-500 transition-all flex items-center gap-2"
                            >
                                💬 Add Comment
                            </button>
                        ) : (
                            <div className="bg-zinc-800 border border-zinc-600 shadow-2xl rounded-lg p-3 w-64 flex flex-col gap-2">
                                <div className="text-xs text-zinc-400 border-l-2 border-yellow-500 pl-2 mb-1 truncate">
                                    Target: "{selectedText}"
                                </div>
                                <textarea
                                    autoFocus
                                    className="bg-black/50 border border-zinc-700 rounded p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                                    rows={3}
                                    placeholder="Type your comment..."
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
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

            {/* --- Right: Comment Sidebar --- */}
            <div className="w-[320px] bg-zinc-900 flex flex-col">
                <div className="h-12 border-b border-zinc-800 flex items-center px-4">
                    <span className="font-medium">Comments ({comments.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {comments.map(c => {
                        const isActive = activeId === c.id;
                        return (
                            <div
                                key={c.id}
                                onClick={() => handleCommentClick(c.id, c.anchor?.blockId)}
                                className={`
                                    p-3 rounded-lg border cursor-pointer transition-all
                                    ${isActive
                                        ? 'bg-yellow-900/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-bold text-sm text-zinc-300">{c.user}</div>
                                    <div className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleTimeString()}</div>
                                </div>

                                {c.anchor?.quote && (
                                    <div className="mb-2 text-xs text-zinc-500 bg-zinc-900 p-1.5 rounded border-l-2 border-zinc-700 truncate font-mono">
                                        "{c.anchor.quote}"
                                    </div>
                                )}

                                <div className="text-sm text-zinc-200 leading-relaxed">
                                    {c.content}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
