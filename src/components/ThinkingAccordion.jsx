import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Think from '@ant-design/x/es/think';

/**
 * ThinkingAccordion - 思维链展示组件（高级版）
 *
 * 折叠模式：单行滚动窗口，一行打完后滚动切换到下一行
 * 展开模式：多行显示，当前行打字 + 后续行骨架屏占位
 *
 * @param {boolean} loading - 是否正在加载
 * @param {string} realTimeLogs - 实时流式日志内容
 */
export default function ThinkingAccordion({
    loading,
    realTimeLogs = null,
}) {
    // ==================== 将内容按行分割 ====================
    const allLines = useMemo(() => {
        if (!realTimeLogs) return [];
        return realTimeLogs.split('\n').filter(line => line.trim().length > 0);
    }, [realTimeLogs]);

    // ==================== 行级状态 ====================
    const [currentLineIdx, setCurrentLineIdx] = useState(0);  // 当前渲染到第几行
    const [currentCharIdx, setCurrentCharIdx] = useState(0);  // 当前行渲染到第几个字符
    const [completedLines, setCompletedLines] = useState([]); // 已完成渲染的行
    const [isExpanded, setIsExpanded] = useState(false);      // 是否展开

    // Refs
    const typingTimerRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // 当前行的完整文本
    const currentLineText = allLines[currentLineIdx] || '';
    // 当前行已渲染的部分
    const currentLineRendered = currentLineText.slice(0, currentCharIdx);
    // 是否还在打字（当前行未完成）
    const isTyping = currentCharIdx < currentLineText.length;
    // 是否还有更多行
    const hasMoreLines = currentLineIdx < allLines.length - 1;
    // 预估的骨架屏行数（后续未渲染的行）
    const skeletonLineCount = Math.max(0, allLines.length - currentLineIdx - 1);

    // ==================== 打字机效果 ====================
    const TYPING_SPEED = 25; // 每字符间隔 (ms)
    const LINE_SWITCH_DELAY = 300; // 行切换延迟 (ms)

    useEffect(() => {
        // 清理
        if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current);
        }

        // 没有内容或加载结束
        if (!loading && allLines.length === 0) {
            return;
        }

        // 当前行还没打完
        if (currentCharIdx < currentLineText.length) {
            typingTimerRef.current = setTimeout(() => {
                setCurrentCharIdx(prev => prev + 1);
            }, TYPING_SPEED);
            return;
        }

        // 当前行打完了，准备切换到下一行
        if (currentLineIdx < allLines.length - 1) {
            // 把当前行加入已完成列表
            if (!completedLines.includes(currentLineText) && currentLineText) {
                setCompletedLines(prev => [...prev, currentLineText]);
            }
            // 延迟后切换到下一行
            typingTimerRef.current = setTimeout(() => {
                setCurrentLineIdx(prev => prev + 1);
                setCurrentCharIdx(0);
            }, LINE_SWITCH_DELAY);
            return;
        }

        // 所有行都打完了
        if (currentLineIdx === allLines.length - 1 && currentCharIdx >= currentLineText.length) {
            // 把最后一行也加入完成列表
            if (!completedLines.includes(currentLineText) && currentLineText) {
                setCompletedLines(prev => [...prev, currentLineText]);
            }
        }

        return () => {
            if (typingTimerRef.current) {
                clearTimeout(typingTimerRef.current);
            }
        };
    }, [currentCharIdx, currentLineIdx, currentLineText, allLines, loading, completedLines]);

    // ==================== 当有新行到达时的处理 ====================
    useEffect(() => {
        // 如果新数据到达，且当前已经打完所有已知行，需要继续
        if (allLines.length > completedLines.length + 1) {
            // 有新行，但我们可能还在打之前的行，不需要特殊处理
        }
    }, [allLines.length, completedLines.length]);

    // ==================== loading 开始时重置 ====================
    useEffect(() => {
        if (loading && allLines.length === 0) {
            setCurrentLineIdx(0);
            setCurrentCharIdx(0);
            setCompletedLines([]);
        }
    }, [loading, allLines.length]);

    // ==================== loading 结束后快速完成剩余 ====================
    useEffect(() => {
        if (!loading && allLines.length > 0) {
            // 加载结束，快速完成所有未渲染的内容
            setCompletedLines(allLines);
            setCurrentLineIdx(allLines.length - 1);
            setCurrentCharIdx(allLines[allLines.length - 1]?.length || 0);
        }
    }, [loading, allLines]);

    // ==================== 自动滚动 ====================
    useEffect(() => {
        if (scrollContainerRef.current && isExpanded) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [completedLines.length, currentCharIdx, isExpanded]);

    // ==================== 渲染 ====================
    const title = loading ? '深度思考中...' : '思考完成';

    // 折叠模式：只显示当前正在打字的一行（滚动窗口效果）
    const renderCollapsedView = () => {
        if (allLines.length === 0) {
            return <span className="thinking-waiting">等待 AI 响应...</span>;
        }

        return (
            <div className="thinking-collapsed-window">
                <div className="thinking-line-scroll">
                    <span className="thinking-line-text">
                        {currentLineRendered}
                    </span>
                    {isTyping && <span className="thinking-cursor">▎</span>}
                </div>
            </div>
        );
    };

    // 展开模式：显示所有行 + 骨架屏
    const renderExpandedView = () => {
        if (allLines.length === 0) {
            return <span className="thinking-waiting">等待 AI 响应...</span>;
        }

        return (
            <div className="thinking-expanded-container" ref={scrollContainerRef}>
                {/* 已完成的行 */}
                {completedLines.map((line, idx) => (
                    <div key={`completed-${idx}`} className="thinking-line completed">
                        <span className="thinking-line-prefix">⮑</span>
                        <span className="thinking-line-text">{line}</span>
                    </div>
                ))}

                {/* 当前正在打字的行（如果不在已完成列表中） */}
                {!completedLines.includes(currentLineText) && currentLineText && (
                    <div className="thinking-line current">
                        <span className="thinking-line-prefix">⮑</span>
                        <span className="thinking-line-text">
                            {currentLineRendered}
                            {isTyping && <span className="thinking-cursor">▎</span>}
                        </span>
                    </div>
                )}

                {/* 骨架屏占位（后续未渲染的行） */}
                {loading && skeletonLineCount > 0 && (
                    <>
                        {Array.from({ length: Math.min(skeletonLineCount, 3) }).map((_, idx) => (
                            <div key={`skeleton-${idx}`} className="thinking-line skeleton">
                                <span className="thinking-line-prefix">⮑</span>
                                <span className="thinking-skeleton-bar" style={{ width: `${60 + Math.random() * 30}%` }} />
                            </div>
                        ))}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="thinking-accordion-wrapper">
            <div className="thinking-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="thinking-header-left">
                    {loading ? (
                        <span className="thinking-spinner" />
                    ) : (
                        <span className="thinking-done-icon">✓</span>
                    )}
                    <span className="thinking-title">{title}</span>
                </div>
                <div className={`thinking-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                    ▼
                </div>
            </div>

            <div className={`thinking-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
                {isExpanded ? renderExpandedView() : renderCollapsedView()}
            </div>
        </div>
    );
}
