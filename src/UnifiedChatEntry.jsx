import React, { useState } from 'react';
import AiChatDashboard from './AiChatDashboard';
import AiChatDashboardV2 from './AiChatDashboardV2';
import UiTabs from './components/UiTabs';

export default function UnifiedChatEntry() {
    const [version, setVersion] = useState('v2'); // Default to NEW Feishu Version

    return (
        <div className="flex flex-col h-screen w-screen bg-black overflow-hidden relative">
            {/* Absolute Switcher on Top-Right or Top-Center? 
          Let's put it at the very top, z-index high. 
      */}
            <div className="shrink-0 z-50">
                <UiTabs
                    active={version}
                    onChange={setVersion}
                    tabs={[
                        { key: 'v2', label: '🚀 Feishu Experience (New)' },
                        { key: 'v1', label: '📦 Legacy Backup (Old)' },
                    ]}
                />
            </div>

            <div className="flex-1 relative min-h-0">
                {/* Use key to force remount when switching to clear state */}
                {version === 'v2' ? (
                    <AiChatDashboardV2 key="v2" />
                ) : (
                    <AiChatDashboard key="v1" />
                )}
            </div>
        </div>
    );
}
