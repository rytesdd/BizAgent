import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';

/**
 * ThinkingAccordion - 思维链展示组件
 * 
 * 支持两种模式：
 * 1. 定时模式：通过 thoughts 数组 + duration 自动打印
 * 2. 实时模式：通过 realTimeLogs 字符串实时展示流式内容
 * 
 * @param {boolean} loading - 是否正在加载
 * @param {string[]} thoughts - 定时模式的思考步骤数组
 * @param {number} duration - 定时模式的总时长（毫秒）
 * @param {string} realTimeLogs - 实时模式的流式日志内容
 */
export default function ThinkingAccordion({
    loading,
    thoughts: thoughtsProp = [],
    duration = 4000,
    realTimeLogs = null
}) {
    // ==================== 稳定 props 引用 ====================
    // 关键修复：用 useMemo + JSON.stringify 稳定 thoughts 数组引用
    const thoughtsKey = JSON.stringify(thoughtsProp);
    const thoughts = useMemo(() => thoughtsProp, [thoughtsKey]);

    // 判断是否为实时模式（注意：空字符串 "" 也算实时模式，只有 null/undefined 才是定时模式）
    const isRealTimeMode = realTimeLogs !== null && realTimeLogs !== undefined;

    // ==================== 实时模式：使用 useMemo 派生值 ====================
    // 关键修复：不使用 useEffect + setState，避免无限循环
    const realTimeLines = useMemo(() => {
        if (!isRealTimeMode) return [];
        if (!realTimeLogs) return []; // 空字符串返回空数组
        return realTimeLogs
            .split('\n')
            .filter(line => line.trim().length > 0);
    }, [realTimeLogs, isRealTimeMode]);

    // ==================== 定时模式：保留原有状态逻辑 ====================
    const [timedLogs, setTimedLogs] = useState([]);

    // 统一的展开/折叠状态
    const [isExpanded, setIsExpanded] = useState(true);

    // 用于追踪是否已自动折叠（防止重复触发）
    const hasAutoCollapsedRef = useRef(false);

    // 用于追踪定时模式是否已初始化（防止重复 setState）
    const timedModeInitializedRef = useRef(false);

    // 滚动容器 ref
    const scrollContainerRef = useRef(null);

    // 根据模式选择显示的日志
    const visibleLogs = isRealTimeMode ? realTimeLines : timedLogs;

    // ==================== 自动滚动：使用 useLayoutEffect 确保稳定 ====================
    useLayoutEffect(() => {
        if (!scrollContainerRef.current || !isExpanded) return;

        // 使用 requestAnimationFrame 确保 DOM 已更新
        const frameId = requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
        });

        return () => cancelAnimationFrame(frameId);
    }, [visibleLogs.length, isExpanded]);

    // ==================== 自动折叠逻辑（两种模式共用） ====================
    useEffect(() => {
        // 加载中时，重置折叠追踪
        if (loading) {
            hasAutoCollapsedRef.current = false;
            return;
        }

        // 没有内容时不折叠
        if (visibleLogs.length === 0) return;

        // 已经自动折叠过，不再重复
        if (hasAutoCollapsedRef.current) return;

        // 加载结束且有内容，延迟自动折叠
        const timer = setTimeout(() => {
            hasAutoCollapsedRef.current = true;
            setIsExpanded(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [loading, visibleLogs.length]);

    // ==================== 定时模式：逐行打印逻辑 ====================
    useEffect(() => {
        // 实时模式跳过
        if (isRealTimeMode) {
            timedModeInitializedRef.current = false;
            return;
        }

        // 加载结束：直接显示全部
        if (!loading) {
            // 只有当内容真的变化时才更新
            setTimedLogs(prev => {
                if (JSON.stringify(prev) === JSON.stringify(thoughts)) return prev;
                return thoughts;
            });
            timedModeInitializedRef.current = false;
            return;
        }

        // 加载中 + 定时模式
        // 检查是否已经初始化过，避免重复触发
        if (timedModeInitializedRef.current) return;
        timedModeInitializedRef.current = true;

        // 重置状态
        setTimedLogs([]);
        setIsExpanded(true);

        if (thoughts.length === 0) return;

        const stepTime = duration / thoughts.length;
        let currentStep = 0;

        const timer = setInterval(() => {
            if (currentStep < thoughts.length) {
                const log = thoughts[currentStep];
                setTimedLogs(prev => {
                    if (prev.includes(log)) return prev;
                    return [...prev, log];
                });
                currentStep++;
            } else {
                clearInterval(timer);
            }
        }, stepTime);

        return () => {
            clearInterval(timer);
            timedModeInitializedRef.current = false;
        };
    }, [loading, thoughts, duration, isRealTimeMode]);

    // ==================== 实时模式启动时展开 ====================
    const prevRealTimeCountRef = useRef(0);
    useEffect(() => {
        if (!isRealTimeMode || !loading) return;

        // 只有当日志数量增加时才展开（避免重复触发）
        if (realTimeLines.length > 0 && realTimeLines.length > prevRealTimeCountRef.current) {
            setIsExpanded(true);
        }
        prevRealTimeCountRef.current = realTimeLines.length;
    }, [isRealTimeMode, loading, realTimeLines.length]);

    // ==================== 重置 ref 当 loading 变化 ====================
    useEffect(() => {
        if (loading) {
            prevRealTimeCountRef.current = 0;
        }
    }, [loading]);

    // 计算显示的时间
    const displayDuration = isRealTimeMode
        ? null
        : (duration / 1000).toFixed(1);

    return (
        <div className="bg-gray-50 rounded-lg border-l-4 border-indigo-400 p-3 font-mono text-xs text-gray-700 w-full mb-2 shadow-sm transition-all duration-300">
            <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {loading ? (
                        <span className="inline-block w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></span>
                    ) : (
                        <span className="text-green-500 text-sm">✅</span>
                    )}
                    <span className="font-semibold text-gray-800">
                        {loading
                            ? "深度思考中..."
                            : displayDuration
                                ? `已深度思考 (${displayDuration}s)`
                                : "思考完成"
                        }
                    </span>
                </div>
                <div className={`text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                </div>
            </div>

            {/* 内容区域：使用 max-h 做简单的展开/折叠动画 */}
            <div
                ref={scrollContainerRef}
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 mt-2 overflow-y-auto' : 'max-h-0 opacity-0 mt-0'}`}
            >
                <div className="pl-6 border-l border-gray-200 ml-2 space-y-1.5 py-1">
                    {visibleLogs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2 animate-fade-in">
                            <span className="text-gray-400 shrink-0">⮑</span>
                            <span className="text-gray-600 leading-tight">{log}</span>
                        </div>
                    ))}
                    {loading && visibleLogs.length === 0 && (
                        <div className="pl-5 animate-pulse text-gray-400">等待 AI 响应...</div>
                    )}
                    {loading && visibleLogs.length > 0 && (
                        <div className="pl-5 animate-pulse text-indigo-400">_</div>
                    )}
                </div>
            </div>
        </div>
    );
}
