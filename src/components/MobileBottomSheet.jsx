import React, { useEffect, useState, useRef } from 'react';

/**
 * MobileBottomSheet (Half-screen Modal)
 * 
 * Interaction:
 * - Slides in from bottom
 * - Drag handle for visual cue
 * - Backdrop click to dismiss
 * - Scrollable content area
 */
export default function MobileBottomSheet({ isOpen, onClose, title, children }) {
    const [animateIn, setAnimateIn] = useState(false);
    const contentRef = useRef(null);

    // Coordinate animation with isOpen state
    useEffect(() => {
        if (isOpen) {
            // Small delay to allow render before transition
            requestAnimationFrame(() => setAnimateIn(true));
            // Prevent body scroll when open
            document.body.style.overflow = 'hidden';
        } else {
            setAnimateIn(false);
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen && !animateIn) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
            {/* Backdrop (Blur + Dim) */}
            <div
                className={`
                    absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out
                    ${animateIn ? 'opacity-100' : 'opacity-0'}
                `}
                onClick={() => {
                    setAnimateIn(false);
                    setTimeout(onClose, 300); // Wait for transition
                }}
            />

            {/* Sheet Content */}
            <div
                ref={contentRef}
                className={`
                    relative w-full max-h-[85vh] min-h-[50vh] bg-[#1c1c1e] 
                    rounded-t-[20px] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out
                    border-t border-zinc-800
                    ${animateIn ? 'translate-y-0' : 'translate-y-full'}
                `}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag Handle Area */}
                <div className="w-full flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1.5 bg-zinc-600 rounded-full opacity-50 hover:opacity-80 transition-opacity" />
                </div>

                {/* Header */}
                <div className="px-5 pb-3 flex items-center justify-between shrink-0 border-b border-zinc-800/50">
                    <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                    <button
                        onClick={() => {
                            setAnimateIn(false);
                            setTimeout(onClose, 300);
                        }}
                        className="p-2 -mr-2 text-zinc-400 hover:text-white bg-zinc-800/50 rounded-full"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
                    {children}
                </div>
            </div>
        </div>
    );
}
