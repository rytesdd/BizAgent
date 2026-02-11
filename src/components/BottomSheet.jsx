import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * BottomSheet - 移动端底部弹出抽屉组件
 *
 * 特性：
 * - 从底部滑入，初始高度 40%
 * - 向上拖拽展开到 80%
 * - 向下拖拽关闭（速度 > 500px/s 或偏移 > 100px）
 * - 处理触摸滚动冲突：当内部滚动到顶部时才允许拖拽
 */
export default function BottomSheet({ isOpen, onClose, children, title, footer }) {
    const [heightPercent, setHeightPercent] = useState(0.4);
    const sheetRef = useRef(null);
    const scrollRef = useRef(null);
    const canDragRef = useRef(true);

    // 重置高度
    useEffect(() => {
        if (isOpen) {
            setHeightPercent(0.4);
        }
    }, [isOpen]);

    // 处理内部滚动与拖拽冲突
    useEffect(() => {
        if (!isOpen) return;

        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        let startY = 0;

        const handleTouchStart = (e) => {
            startY = e.touches[0].clientY;
            // 检查是否在顶部
            canDragRef.current = scrollContainer.scrollTop <= 0;
        };

        const handleTouchMove = (e) => {
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            // 在顶部 && 向下滑动 → 允许拖拽 Sheet，阻止内部滚动
            if (scrollContainer.scrollTop <= 0 && deltaY > 0) {
                canDragRef.current = true;
            } else {
                canDragRef.current = false;
            }
        };

        scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });

        return () => {
            scrollContainer.removeEventListener('touchstart', handleTouchStart);
            scrollContainer.removeEventListener('touchmove', handleTouchMove);
        };
    }, [isOpen]);

    // 拖拽结束判断
    const handleDragEnd = useCallback((event, info) => {
        const { offset, velocity } = info;

        // 向下拖拽 > 100px 或速度 > 500 → 关闭
        if (offset.y > 100 || velocity.y > 500) {
            onClose();
            return;
        }

        // 向上拖拽 > 100px 或速度 > 500 → 展开到 80%
        if (offset.y < -100 || velocity.y < -500) {
            setHeightPercent(0.8);
            return;
        }

        // 否则回弹到当前状态
    }, [onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-40"
                        style={{ touchAction: 'none' }} // Risk #2: 防止滚动穿透
                    />

                    {/* Sheet 主体 */}
                    <motion.div
                        ref={sheetRef}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.1}
                        onDragEnd={handleDragEnd}
                        dragListener={canDragRef.current}
                        initial={{ y: '100%' }}
                        animate={{
                            y: `${(1 - heightPercent) * 100}%`,
                        }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: 'spring',
                            damping: 30,
                            stiffness: 300,
                        }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl flex flex-col"
                        style={{
                            height: '100%',
                            touchAction: 'none',
                        }}
                    >
                        {/* 拖拽指示条 */}
                        <div className="flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1 bg-zinc-700 rounded-full" />
                        </div>

                        {/* 标题栏 */}
                        {title && (
                            <div className="flex items-center justify-between px-4 pb-2 shrink-0 border-b border-zinc-800">
                                <span className="text-sm font-medium text-zinc-100">{title}</span>
                                <button
                                    onClick={onClose}
                                    className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* 内容区域 */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-4 pb-4"
                            onClick={(e) => e.stopPropagation()} // 防止点击内容触发意想不到的 Sheet 行为
                        >
                            {children}
                        </div>

                        {/* 底部 Footer (固定区域) */}
                        {footer && (
                            <div
                                className="shrink-0 border-t border-zinc-800 bg-zinc-900 pb-safe"
                                onPointerDown={(e) => e.stopPropagation()} // 阻止拖拽手势传播 (Risk #4)
                                onTouchStart={(e) => e.stopPropagation()}
                            >
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
