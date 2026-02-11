import React from 'react';
import { useChatStore } from '../../store/chatStore';

/**
 * AgentControlCard - A simple card to toggle AI Auto-Reply
 * 
 * Used when user types "开启AI自动回复" or "停止AI自动回复" on mobile.
 */
const AgentControlCard = ({ data }) => {
    // We can also use store directly here to ensure sync, or use props passed from MessageRenderer from widget data.
    // However, widget data is static snapshot. The toggle should consistently reflect CURRENT store state.
    // So we use store state for the value, but we can use widget data for initial label or context if needed.

    const { agentEnabled, setAgentEnabled } = useChatStore();

    const handleToggle = () => {
        const newState = !agentEnabled;
        setAgentEnabled(newState);
    };

    return (
        <div className="bg-[#1E1E1E] rounded-xl p-4 border border-zinc-800 shadow-lg max-w-[280px]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${agentEnabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                            <path d="M12 2a10 10 0 0 1 10 10"></path>
                            <path d="M12 22a10 10 0 0 1-10-10"></path>
                            <path d="M12 22a10 10 0 0 0 10-10"></path>
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-zinc-200">
                            AI 自动回复
                        </div>
                        <div className={`text-xs ${agentEnabled ? 'text-green-500' : 'text-zinc-500'}`}>
                            {agentEnabled ? '已开启' : '已停止'}
                        </div>
                    </div>
                </div>

                {/* Toggle Switch */}
                <button
                    onClick={handleToggle}
                    className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none ${agentEnabled ? 'bg-green-600' : 'bg-zinc-600'}`}
                >
                    <div
                        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${agentEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                </button>
            </div>

            {/* Optional Description */}
            <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 leading-relaxed">
                {agentEnabled
                    ? "AI 将作为乙方代理，自动分析并回复客户未处理的评论。"
                    : "AI 自动回复已暂停。您可以手动控制回复或点击上方开关重新开启。"
                }
            </div>
        </div>
    );
};

export default AgentControlCard;
