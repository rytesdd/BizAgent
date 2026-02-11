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
        <div className="w-full flex flex-col bg-[#18181b] border-b border-zinc-800 shrink-0 z-50 sticky top-0 shadow-sm mobile-header">

            {/* Row 1: Controls (Role, Persona, Config, Version) */}
            <div className="w-full flex items-center justify-between px-4 py-2 gap-3 border-b border-zinc-800/50">
                {/* 1. Role Switcher */}
                <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800 shrink-0">
                    <button
                        onClick={() => setCurrentRole('PARTY_A')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${currentRole === 'PARTY_A'
                            ? 'bg-zinc-700 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        甲方
                    </button>
                    <button
                        onClick={() => setCurrentRole('PARTY_B')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${currentRole === 'PARTY_B'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        乙方
                    </button>
                </div>

                {/* Right Actions Group */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* 2. Persona Button */}
                    <button
                        onClick={() => sidebarRef?.current?.openPersonaConfig()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                        title="人设设置"
                    >
                        <span className="text-lg">🎭</span>
                    </button>

                    {/* 3. Config Button */}
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                        title="系统配置"
                    >
                        <IconMenu className="w-4 h-4" />
                    </button>

                    {/* 4. Version Button (Dropdown) */}
                    <Dropdown
                        menu={{
                            items: getMenuItems(),
                            className: "mobile-menu-overlay"
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                    >
                        <button className="h-9 px-3 flex items-center gap-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all">
                            <span className="text-xs font-mono font-medium">{appVersion}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                    </Dropdown>
                </div>
            </div>

            {/* Row 2: Back & Title (Height 48px) */}
            <div className="h-[48px] w-full flex items-center px-4">
                <div className="flex items-center gap-3 w-full overflow-hidden">
                    {mobilePanel === 'document' ? (
                        <button
                            onClick={handleBackToChat}
                            className="text-zinc-400 hover:text-white transition-colors p-1 -ml-1 active:bg-zinc-800 rounded-full shrink-0"
                            aria-label="Back"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-6 h-6 flex items-center justify-center bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20 shrink-0">
                            <span className="font-extrabold text-white text-[10px]">Biz</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-bold text-base text-zinc-100 whitespace-nowrap truncate">
                            {mobilePanel === 'document' ? 'Product Requirement Document' : 'BizAgent Workspace'}
                        </span>
                        {mobilePanel === 'document' && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-mono shrink-0">
                                {documentVersions?.[activeVersionIndex]?.id || 'v1.0'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* <style jsx global> removed, using import './MobileHeader.css' instead */}

        </div>
    );
};

export default MobileHeader;
