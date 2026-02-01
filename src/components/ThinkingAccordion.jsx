import { useState, useEffect } from 'react';

export default function ThinkingAccordion({ loading, thoughts = [], duration = 4000 }) {
    const [visibleLogs, setVisibleLogs] = useState([]);
    const [isExpanded, setIsExpanded] = useState(true);

    // 自适应流式打印逻辑
    useEffect(() => {
        if (!loading) {
            // 加载结束：直接显示全部
            setVisibleLogs(thoughts);
            // 自动折叠 (用户要求: "The bubble snaps shut")
            setIsExpanded(false);
            return;
        }

        // 重置状态
        setVisibleLogs([]);
        setIsExpanded(true);

        const stepTime = duration / thoughts.length;
        let currentStep = 0;

        const timer = setInterval(() => {
            if (currentStep < thoughts.length) {
                // 使用函数式更新确保数据准确，但要注意 currentStep 是闭包变量
                const log = thoughts[currentStep];
                setVisibleLogs(prev => {
                    // 防止重复添加
                    if (prev.includes(log)) return prev;
                    return [...prev, log];
                });
                currentStep++;
            } else {
                clearInterval(timer);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [loading, thoughts, duration]);

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
                        {loading ? "深度思考中..." : `已深度思考 (${(duration / 1000).toFixed(1)}s)`}
                    </span>
                </div>
                <div className={`text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                </div>
            </div>

            {/* 内容区域：使用 max-h 做简单的展开/折叠动画 */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}
            >
                <div className="pl-6 border-l border-gray-200 ml-2 space-y-1.5 py-1">
                    {visibleLogs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2 animate-fade-in">
                            <span className="text-gray-400 shrink-0">⮑</span>
                            <span className="text-gray-600 leading-tight">{log}</span>
                        </div>
                    ))}
                    {loading && visibleLogs.length < thoughts.length && (
                        <div className="pl-5 animate-pulse text-gray-400">...</div>
                    )}
                </div>
            </div>
        </div>
    );
}
