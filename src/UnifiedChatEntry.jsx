import React from 'react';
import DualRoleView from './experiments/DualRoleView';

export default function UnifiedChatEntry() {
    return (
        <div className="flex flex-col h-screen w-screen bg-[#000000] overflow-hidden relative">
            <div className="flex-1 relative min-h-0">
                <DualRoleView />
            </div>
        </div>
    );
}
