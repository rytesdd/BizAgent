import React, { useState, useEffect } from 'react';

const THOUGHT_STEPS = [
    "正在初始化多模态视觉扫描模型...",
    "已识别关键 UI 区域：[定价卡片]、[功能列表]、[底部条款]...",
    "正在进行 OCR 文字提取与语义分析...",
    "深度检查：检测到“25积分”与背景对比度略低 (WCAG 标准)...",
    "逻辑校验：正在比对“免费缓冲期”日期与 SLA 协议数据库...",
    "✅ 审查完成，正在生成结构化建议..."
];

const ThinkingOverlay = ({ isVisible, duration = 4000 }) => {
    const [visibleLines, setVisibleLines] = useState([]);

    useEffect(() => {
        if (isVisible) {
            setVisibleLines([]); // Reset
            let currentStep = 0;
            const stepTime = duration / THOUGHT_STEPS.length;

            const timer = setInterval(() => {
                if (currentStep < THOUGHT_STEPS.length) {
                    setVisibleLines(prev => [...prev, THOUGHT_STEPS[currentStep]]);
                    currentStep++;
                } else {
                    clearInterval(timer);
                }
            }, stepTime);

            return () => clearInterval(timer);
        }
    }, [isVisible, duration]);

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50, // Ensure it's on top of document content
            background: 'rgba(30, 41, 59, 0.95)', // Dark slate, high opacity
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            color: '#00dcb4', // AI Cyan/Green color
            fontFamily: 'monospace',
            fontSize: '13px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'slideDown 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: '8px' }}>
                <span className="anticon-spin" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>AI 智能审查思维链</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {visibleLines.map((line, idx) => (
                    <div key={idx} style={{ opacity: 0.9, animation: 'fadeIn 0.2s' }}>
                        <span style={{ marginRight: '8px', opacity: 0.5 }}>{'>'}</span>
                        {line}
                    </div>
                ))}
                <div className="animate-pulse" style={{ opacity: 0.5, marginTop: '4px' }}>_</div>
            </div>
            <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
        </div>
    );
};

export default ThinkingOverlay;
