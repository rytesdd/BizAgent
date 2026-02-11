import React, { useState } from 'react';
import { Dropdown } from 'antd';
import { IconMenu, IconAI } from '../svg-icons';
import AgentProcessCycle from './AgentProcessCycle';
import { getStoredAppVersion, setStoredAppVersion } from './AppVersionSwitch';
import { useChatStore } from '../store/chatStore';
import './MobileHeader.css';

const MobileHeader = ({
    mobilePanel,
    handleBackToChat,
    currentRole,
    setCurrentRole,
    // Agent props removed, using store
    onTriggerAiReview,
    setIsConfigOpen,
    documentVersions,
    activeVersionIndex,
    onVersionSwitch,
    handleSendRequirementConfirmation,
    requirementConfirmSent,
    sidebarRef
}) => {
    // Access global Agent state
    const {
        agentEnabled,
        setAgentEnabled
    } = useChatStore();
    // App Version State for Mobile Switcher
    const [appVersion, setAppVersion] = useState(getStoredAppVersion());

    const handleAppVersionChange = (newVersion) => {
        setAppVersion(newVersion);
        setStoredAppVersion(newVersion);
        // Force reload to apply version change (as per original AppVersionSwitch logic)
        window.location.reload();
    };

    const getMenuItems = () => {
        const items = [
            // App Version Switcher
            {
                key: 'app-version-group',
                type: 'group',
                label: <span className="text-zinc-500 text-xs font-bold px-2 uppercase tracking-wider">App Version</span>,
                children: [
                    {
                        key: 'app-ver-switch',
                        label: (
                            <div className="flex items-center justify-between px-1 py-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs text-zinc-500">Current</span>
                                <div className="flex bg-zinc-800 rounded p-0.5 scale-90 origin-right">
                                    <button
                                        onClick={() => handleAppVersionChange('v0.1')}
                                        className={`px-2 py-0.5 text-xs rounded font-medium ${appVersion === 'v0.1' ? 'bg-zinc-600 text-white' : 'text-zinc-500'}`}
                                    >v0.1</button>
                                    <button
                                        onClick={() => handleAppVersionChange('v0.2')}
                                        className={`px-2 py-0.5 text-xs rounded font-medium ${appVersion === 'v0.2' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}
                                    >v0.2</button>
                                </div>
                            </div>
                        )
                    }
                ]
            }
        ].filter(Boolean);

        return items;
    };

    return (
        <div className="h-14 w-full flex items-center justify-between px-3 bg-[#18181b] border-b border-zinc-800 shrink-0 z-50 sticky top-0 shadow-sm mobile-header">
            {/* Left: Logo or Back Button */}
            <div className="flex items-center gap-2">
                {mobilePanel === 'document' ? (
                    <button
                        onClick={handleBackToChat}
                        className="text-zinc-400 hover:text-white transition-colors p-1 active:bg-zinc-800 rounded-full"
                        aria-label="Back"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                ) : (
                    <div className="w-7 h-7 flex items-center justify-center bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20 shrink-0">
                        <span className="font-extrabold text-white text-xs">Biz</span>
                    </div>
                )}

                {mobilePanel === 'document' && (
                    <div className="flex flex-col justify-center">
                        <span className="font-bold text-sm text-zinc-100 leading-tight">Doc</span>
                        <span className="text-[9px] text-zinc-500 font-mono">{documentVersions?.[activeVersionIndex]?.id || 'v1.0'}</span>
                    </div>
                )}
            </div>

            {/* Right: Flattened Controls */}
            <div className="flex items-center gap-3">

                {/* 1. Role Switcher */}
                <div className="flex bg-zinc-800 rounded p-0.5">
                    <button
                        onClick={() => setCurrentRole('PARTY_A')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${currentRole === 'PARTY_A'
                            ? 'bg-zinc-600 text-white shadow'
                            : 'text-zinc-400'
                            }`}
                    >
                        甲方
                    </button>
                    <button
                        onClick={() => setCurrentRole('PARTY_B')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${currentRole === 'PARTY_B'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-zinc-400'
                            }`}
                    >
                        乙方
                    </button>
                </div>

                {/* 2. Agent Toggle (Only for Vendor) */}
                {currentRole === 'PARTY_B' && (
                    <button
                        onClick={() => setAgentEnabled(!agentEnabled)}
                        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${agentEnabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                        title="Toggle Agent"
                    >
                        <IconAI className="w-4 h-4" />
                    </button>
                )}

                {/* 3. System Icons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => sidebarRef?.current?.openPersonaConfig()}
                        className="w-7 h-7 flex items-center justify-center text-lg hover:bg-zinc-800 rounded-full transition-colors"
                        title="人设设置"
                    >
                        🎭
                    </button>
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-200"
                        title="系统配置"
                    >
                        <IconMenu className="w-4 h-4" />
                    </button>
                </div>

                {/* 4. More Menu (App Version only) */}
                <Dropdown
                    menu={{
                        items: getMenuItems(),
                        className: "mobile-menu-overlay"
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                >
                    <button className="p-1 text-zinc-400 hover:text-white transition-colors active:bg-zinc-800 rounded-lg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="19" cy="12" r="1" />
                            <circle cx="5" cy="12" r="1" />
                        </svg>
                    </button>
                </Dropdown>
            </div>

            {/* <style jsx global> removed, using import './MobileHeader.css' instead */}

        </div>
    );
};

export default MobileHeader;
