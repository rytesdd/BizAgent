/**
 * AlertCard - 风险/警告/通知卡片
 * 
 * 根据 level 显示不同颜色：
 * - danger: 红色（紧急风险）
 * - warning: 橙色（警告）
 * - info: 蓝色（信息）
 * - success: 绿色（成功）
 */

import React from 'react';

const LEVEL_STYLES = {
    danger: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        icon: '🚨',
        iconBg: 'bg-red-500/20',
        titleColor: 'text-red-400',
        textColor: 'text-red-300/80'
    },
    warning: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        icon: '⚠️',
        iconBg: 'bg-orange-500/20',
        titleColor: 'text-orange-400',
        textColor: 'text-orange-300/80'
    },
    info: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        icon: 'ℹ️',
        iconBg: 'bg-blue-500/20',
        titleColor: 'text-blue-400',
        textColor: 'text-blue-300/80'
    },
    success: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        icon: '✅',
        iconBg: 'bg-green-500/20',
        titleColor: 'text-green-400',
        textColor: 'text-green-300/80'
    }
};

export default function AlertCard({ data }) {
    const { level = 'info', title, message } = data || {};
    const style = LEVEL_STYLES[level] || LEVEL_STYLES.info;

    return (
        <div className={`
            rounded-xl ${style.bg} ${style.border} border
            p-4 w-full overflow-hidden
        `}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`
                    w-8 h-8 rounded-lg ${style.iconBg}
                    flex items-center justify-center text-lg shrink-0
                `}>
                    {style.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {title && (
                        <h4 className={`font-semibold ${style.titleColor} mb-1 truncate`}>
                            {title}
                        </h4>
                    )}
                    {message && (
                        <p className={`text-sm ${style.textColor} leading-relaxed break-words`}>
                            {message}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
