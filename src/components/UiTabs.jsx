import React from 'react';

export default function UiTabs({ active, onChange, tabs }) {
    return (
        <div className="flex bg-zinc-900 border-b border-zinc-800 px-4">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`
            px-6 py-3 text-sm font-medium border-b-2 transition-colors relative
            ${active === tab.key
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300'}
          `}
                >
                    {tab.label}
                    {active === tab.key && (
                        <span className="absolute inset-x-0 bottom-[-2px] h-0.5 bg-blue-500 shadow-[0_-2px_6px_rgba(59,130,246,0.5)]"></span>
                    )}
                </button>
            ))}
        </div>
    );
}
