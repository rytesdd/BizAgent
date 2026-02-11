import React from 'react';

const VERSIONS = [
    { key: 'v0.1', label: 'v0.1' },
    { key: 'v0.2', label: 'v0.2' },
];

const STORAGE_KEY = 'bizagent_app_version';

export function getStoredAppVersion() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v && VERSIONS.some(ver => ver.key === v)) return v;
    } catch { }
    return 'v0.2'; // 默认使用最新版本
}

export function setStoredAppVersion(version) {
    try {
        localStorage.setItem(STORAGE_KEY, version);
    } catch { }
}

export default function AppVersionSwitch({ current, onChange }) {
    return (
        <div className="fixed top-3 right-3 z-[9999] flex items-center gap-1 bg-[#18181b]/90 backdrop-blur-sm border border-zinc-700/50 rounded-full px-1 py-1 shadow-lg">
            {VERSIONS.map(v => (
                <button
                    key={v.key}
                    onClick={() => {
                        if (v.key !== current) {
                            setStoredAppVersion(v.key);
                            onChange(v.key);
                        }
                    }}
                    className={`
                        px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                        ${v.key === current
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }
                    `}
                >
                    {v.label}
                </button>
            ))}
        </div>
    );
}