import React from 'react';

// ============================================
// Helper: Highlighter Component (Multi-match support)
// ============================================
const Highlighter = ({ text, blockId, comments = [], activeCommentId, onElementClick }) => {
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
            const isTargetMatch = c.targetId && c.targetId === activeCommentId;
            const isIdMatch = c.id === activeCommentId;
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
            backgroundColor: '#fbbf24', // Amber 400 - Distinct active state
            color: '#000000',           // Black text for maximum contrast
            borderBottom: '2px solid #b45309', // Dark amber border
            transition: 'all 0.2s',
            cursor: 'pointer',
            boxShadow: '0 0 4px rgba(251, 191, 36, 0.5)' // Subtle glow
        } : {
            backgroundColor: '#fef08a', // Yellow 200 - Readable highlight
            color: '#000000',           // Black text for contrast
            borderBottom: '2px solid transparent',
            transition: 'all 0.2s',
            cursor: 'pointer'
        };

        result.push(
            <span
                key={`match-${match.start}`}
                style={style}
                className="hover:brightness-90 active:brightness-75"
                onClick={(e) => {
                    e.stopPropagation();
                    console.log('🖱️ [Highlighter] Clicked blockId:', blockId);
                    onElementClick?.(blockId);
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

export default Highlighter;
