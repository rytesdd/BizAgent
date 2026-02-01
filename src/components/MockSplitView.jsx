import React from 'react';
import ReactMarkdown from 'react-markdown';

const MOCK_PRD_CONTENT = `### 1. 调整原因
为了进一步加大在 AI 快搭技术上的投入，提升输出物的准确性，决定调整计费模式。
2. 调整内容 (2026年2月26日生效)
(一) AI 快搭收费规则

SAAS 团队版: 生成页面 25积分/次

SAAS 企业版: 生成页面 50积分/次，包含高级 UI 修改权限。

(二) 过渡期安排 2026年1月26日至2月25日期间，仍可免费试用。`;

const MockSplitView = () => {
    return (
        <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-white font-sans overflow-hidden">
            {/* Top Panel - 65% height: Interactive Prototype Area */}
            <div style={{ height: '65%' }} className="overflow-y-auto border-b-2 border-[#333] relative">
                <style>{`
              /* Force override global !important 12px font-size */
              .demo-container { background: #1e1e1e; color: white; padding: 20px; font-family: sans-serif; height: 100%; box-sizing: border-box; font-size: 14px !important; }
              .demo-container * { font-size: inherit; } /* Reset children to inherit unless specified */
              
              .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
              .card { border: 1px solid #333; border-radius: 8px; padding: 20px; background: #252525; transition: all 0.2s; cursor: pointer; }
              .card:hover { border-color: #3b82f6; background: #2a2a2a; transform: translateY(-2px); }
              
              .demo-container h2 { color: white; font-size: 18px !important; margin: 0; font-weight: bold; }
              .card h3 { color: #9ca3af; font-size: 14px !important; margin: 0; }
              
              .price { font-size: 24px !important; font-weight: bold; margin: 10px 0; color: white; }
              .price-suffix { font-size: 12px !important; font-weight: normal; }
              
              .btn { display: block; width: 100%; padding: 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; margin-top: 15px; cursor: pointer; font-size: 14px !important; }
              .btn:hover { background: #2563eb; }
              
              .tag { background: #374151; color: #d1d5db; padding: 2px 6px; border-radius: 4px; font-size: 10px !important; margin-right: 5px; }
              .status-dot { color: #4ade80; font-size: 12px !important; }
           `}</style>
                <div className="demo-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2>MasterGo AI 计费方案预览</h2>
                        <span className="status-dot">● 交互原型已就绪</span>
                    </div>
                    <div className="pricing-grid">
                        <div className="card">
                            <h3>SAAS 团队版</h3>
                            <div className="price">25积分 <span className="price-suffix">/次</span></div>
                            <div style={{ margin: '10px 0' }}>
                                <span className="tag">生成页面</span> <span className="tag">极速模式</span>
                            </div>
                            <button className="btn" onClick={() => alert('Demo: 已选择团队版')}>选择方案</button>
                        </div>
                        <div className="card" style={{ borderColor: '#3b82f6' }}>
                            <h3>SAAS 企业版 (推荐)</h3>
                            <div className="price">50积分 <span className="price-suffix">/次</span></div>
                            <div style={{ margin: '10px 0' }}>
                                <span className="tag">UI生成</span> <span className="tag">私有化部署</span>
                            </div>
                            <button className="btn" onClick={() => alert('Demo: 已选择企业版')}>立即升级</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Panel - 35% height: PRD Document Area */}
            <div style={{ height: '35%' }} className="overflow-y-auto p-4 bg-[#09090b]">
                <div className="text-[#d4d4d8] text-sm leading-relaxed whitespace-pre-wrap">
                    <ReactMarkdown>{MOCK_PRD_CONTENT}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default MockSplitView;
