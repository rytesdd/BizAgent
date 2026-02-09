/**
 * NotificationCard - Critical Alert Card
 * 
 * Purpose: Critical alerts with level-based styling.
 * Props: { level, title, message, source, time }
 * 
 * UI Layout:
 * - Container: border-l-4 with level-based color
 * - Header: Alert Triangle Icon + Title (Bold)
 * - Body: Message text
 * - Footer: Source + Time in tiny text
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Info, Bell } from 'lucide-react';

/**
 * Level configuration for different alert types
 */
const getLevelConfig = (level) => {
    const normalized = (level || '').toLowerCase();

    if (/danger|critical|error|危险|严重/.test(normalized)) {
        return {
            borderColor: 'border-l-red-500',
            bgColor: 'bg-red-500/5',
            iconColor: 'text-red-500',
            titleColor: 'text-red-400',
            Icon: AlertTriangle
        };
    }

    if (/warning|warn|警告|注意/.test(normalized)) {
        return {
            borderColor: 'border-l-orange-500',
            bgColor: 'bg-orange-500/5',
            iconColor: 'text-orange-500',
            titleColor: 'text-orange-400',
            Icon: AlertCircle
        };
    }

    if (/info|信息|提示/.test(normalized)) {
        return {
            borderColor: 'border-l-blue-500',
            bgColor: 'bg-blue-500/5',
            iconColor: 'text-blue-500',
            titleColor: 'text-blue-400',
            Icon: Info
        };
    }

    // Default notification style
    return {
        borderColor: 'border-l-zinc-500',
        bgColor: 'bg-zinc-800/50',
        iconColor: 'text-zinc-400',
        titleColor: 'text-zinc-300',
        Icon: Bell
    };
};

/**
 * Format time display
 */
const formatTime = (time) => {
    if (!time) return null;

    // If it's already a string, return as is
    if (typeof time === 'string') return time;

    // If it's a Date object, format it
    if (time instanceof Date) {
        const now = new Date();
        const diff = now - time;

        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;

        return time.toLocaleDateString('zh-CN');
    }

    return String(time);
};

/**
 * @param {Object} props
 * @param {Object} props.data - Notification data
 */
const NotificationCard = ({ data }) => {
    if (!data) return null;

    const { level, title, message, source, time } = data;
    const config = getLevelConfig(level);
    const { Icon } = config;
    const displayTime = formatTime(time);

    return (
        <div className={`
            w-full rounded-lg overflow-hidden
            border-l-4 ${config.borderColor}
            ${config.bgColor}
        `}>
            <div className="px-4 py-3">
                {/* Header: Icon + Title */}
                <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${config.iconColor} flex-shrink-0`} />
                    <h4 className={`text-sm font-semibold ${config.titleColor} truncate`}>
                        {title || 'Notification'}
                    </h4>
                </div>

                {/* Body: Message */}
                {message && (
                    <p className="text-xs text-zinc-400 leading-relaxed mb-2 pl-6">
                        {message}
                    </p>
                )}

                {/* Footer: Source + Time */}
                {(source || displayTime) && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 pl-6">
                        {source && <span>{source}</span>}
                        {source && displayTime && <span>•</span>}
                        {displayTime && <span>{displayTime}</span>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationCard;
