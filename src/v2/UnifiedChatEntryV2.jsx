import React from 'react';
import DualRoleViewV2 from './DualRoleViewV2';

export default function UnifiedChatEntryV2() {
    return (
        <div className="flex flex-col h-screen w-screen bg-[#000000] overflow-hidden relative">
            <div className="flex-1 relative min-h-0">
                <DualRoleViewV2 />
            </div>
        </div>
    );
}