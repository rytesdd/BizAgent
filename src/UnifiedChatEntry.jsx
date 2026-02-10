import React, { useState } from 'react';
import DualRoleView from './experiments/DualRoleView';
import DualRoleViewV2 from './experiments/DualRoleViewV2';

export default function UnifiedChatEntry() {
    const [activeVersion, setActiveVersion] = useState('v1'); // 'v1' | 'v2'

    return (
        <div className="flex flex-col h-screen w-screen bg-[#000000] overflow-hidden relative">
            {/* ========================================== */}
            {/* Version Switcher - 悬浮在右下角            */}
            {/* ========================================== */}
            <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-1 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/60 rounded-full p-1 shadow-2xl shadow-black/50">
                <button
                    onClick={() => setActiveVersion('v1')}
                    className={`
                        px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300
                        ${activeVersion === 'v1'
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }
                    `}
                >
                    <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${activeVersion === 'v1' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                        版本 1.0
                    </span>
                </button>
                <button
                    onClick={() => setActiveVersion('v2')}
                    className={`
                        px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300
                        ${activeVersion === 'v2'
                            ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }
                    `}
                >
                    <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${activeVersion === 'v2' ? 'bg-white' : 'bg-violet-500'}`}></span>
                        版本 2.0
                    </span>
                </button>
            </div>

            {/* ========================================== */}
            {/* Content Area                               */}
            {/* ========================================== */}
            <div className="flex-1 relative min-h-0">
                {activeVersion === 'v1' ? (
                    <DualRoleView />
                ) : (
                    <DualRoleViewV2 />
                )}
            </div>
        </div>
    );
}
