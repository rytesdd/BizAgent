import React from 'react';
import { IconMenu, IconAI } from '../svg-icons';
import AgentProcessCycle from './AgentProcessCycle';
import { useChatStore } from '../store/chatStore';

const DesktopHeader = ({
    currentRole,
    setCurrentRole,
    // Agent props removed, using store
    onTriggerAiReview,
    setIsConfigOpen,
    sidebarRef
}) => {
    // Access global Agent state
    const {
        agentEnabled,
        setAgentEnabled,
        isAgentTyping
    } = useChatStore();
    return (
        <div className="h-14 w-full flex items-center justify-between px-5 bg-zinc-900 rounded-xl shrink-0">
            <div className="flex items-center gap-3">
                <span className="font-bold text-base text-zinc-100">
                    BizAgent
                </span>

                {/* 角色切换 */}
                <div className="flex bg-zinc-800 rounded-lg p-0.5 ml-4">
                    <button
                        onClick={() => setCurrentRole('PARTY_A')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentRole === 'PARTY_A'
                            ? 'bg-[#3B82F6] text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        甲方
                    </button>
                    <button
                        onClick={() => setCurrentRole('PARTY_B')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentRole === 'PARTY_B'
                            ? 'bg-[#3B82F6] text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        乙方
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Agent 控制 - 仅党B */}
                {currentRole === 'PARTY_A' ? (
                    <button
                        onClick={onTriggerAiReview} // Changed from handleAiReviewTrigger to prop
                        style={{ display: 'none' }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-white text-black hover:bg-zinc-200 shadow-sm"
                    >
                        <IconAI className="w-3.5 h-3.5" />
                        AI Review
                    </button>
                ) : (
                    <div className="flex items-center gap-3 bg-zinc-800 rounded-full px-3 py-1 text-xs">
                        {isAgentTyping && (
                            <AgentProcessCycle onComplete={() => { }} />
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">启用Agent自动回复</span>
                            <button
                                onClick={() => setAgentEnabled(!agentEnabled)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${agentEnabled ? 'bg-green-500' : 'bg-zinc-600'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${agentEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                )}

                {/* 人设设置按钮（固定唯一入口） */}
                <button
                    onClick={() => sidebarRef?.current?.openPersonaConfig()}
                    className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                    title="人设设置"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>

                {/* 系统配置按钮 */}
                <button
                    onClick={() => setIsConfigOpen(true)}
                    className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                    title="系统配置"
                >
                    <IconMenu className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default DesktopHeader;
