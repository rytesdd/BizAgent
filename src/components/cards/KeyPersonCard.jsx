/**
 * KeyPersonCard - Stakeholder Insight Card
 * 
 * Purpose: Insight into stakeholders.
 * Props: { name, role, stance, influence, pain_point }
 * 
 * UI Layout:
 * - Header: Avatar (colored circle with initials) + Name + Role (gray text)
 * - Stats Row: Stance badge + Influence meter
 * - Footer: Pain point highlighted box
 */

import React from 'react';
import { Target, Star, StarHalf } from 'lucide-react';

/**
 * Get initials from name (supports Chinese and English names)
 */
const getInitials = (name) => {
    if (!name) return '?';

    // For Chinese names, take just the last character
    if (/[\u4e00-\u9fa5]/.test(name)) {
        return name.slice(-1);
    }

    // For English names, take first letters
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

/**
 * Generate a consistent color based on name
 */
const getAvatarColor = (name) => {
    const colors = [
        'from-violet-500 to-purple-600',
        'from-blue-500 to-cyan-500',
        'from-emerald-500 to-teal-500',
        'from-orange-500 to-amber-500',
        'from-pink-500 to-rose-500',
        'from-indigo-500 to-blue-500',
    ];

    if (!name) return colors[0];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
};

/**
 * Stance badge configuration
 */
const getStanceConfig = (stance) => {
    const normalized = (stance || '').toLowerCase();

    if (/support|支持|赞成/.test(normalized)) {
        return {
            label: stance || 'Support',
            className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        };
    }

    if (/oppose|反对|阻碍/.test(normalized)) {
        return {
            label: stance || 'Oppose',
            className: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
    }

    // Neutral or unknown
    return {
        label: stance || 'Neutral',
        className: 'bg-zinc-600/30 text-zinc-400 border-zinc-500/30'
    };
};

/**
 * Influence level configuration
 */
const getInfluenceLevel = (influence) => {
    const normalized = (influence || '').toLowerCase();

    if (/high|高|强/.test(normalized)) {
        return { level: 3, color: 'text-amber-400' };
    }

    if (/medium|中|一般/.test(normalized)) {
        return { level: 2, color: 'text-zinc-400' };
    }

    // Low
    return { level: 1, color: 'text-zinc-500' };
};

/**
 * Influence star meter component
 */
const InfluenceMeter = ({ influence }) => {
    const { level, color } = getInfluenceLevel(influence);

    return (
        <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 mr-1">影响力</span>
            <div className="flex">
                {[1, 2, 3].map((i) => (
                    <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i <= level ? color : 'text-zinc-700'}`}
                        fill={i <= level ? 'currentColor' : 'none'}
                        strokeWidth={i <= level ? 0 : 1.5}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * @param {Object} props
 * @param {Object} props.data - KeyPerson data
 */
const KeyPersonCard = ({ data }) => {
    if (!data) return null;

    const { name, role, stance, influence, pain_point } = data;
    const initials = getInitials(name);
    const avatarColor = getAvatarColor(name);
    const stanceConfig = getStanceConfig(stance);

    return (
        <div className="w-full rounded-xl bg-zinc-900 border border-white/10 overflow-hidden">
            {/* Header: Avatar + Name + Role */}
            <div className="px-4 py-3 flex items-center gap-3">
                {/* Avatar */}
                <div className={`
                    w-10 h-10 rounded-full 
                    bg-gradient-to-br ${avatarColor}
                    flex items-center justify-center
                    text-white text-sm font-bold
                    shadow-lg
                `}>
                    {initials}
                </div>

                {/* Name + Role */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-100 truncate">
                        {name || 'Unknown'}
                    </h4>
                    <p className="text-xs text-zinc-500 truncate">
                        {role || 'No role specified'}
                    </p>
                </div>
            </div>

            {/* Stats Row: Stance + Influence */}
            <div className="px-4 pb-3 flex items-center justify-between">
                {/* Stance Badge */}
                <span className={`
                    text-xs font-medium px-2.5 py-1 rounded-full border
                    ${stanceConfig.className}
                `}>
                    {stanceConfig.label}
                </span>

                {/* Influence Meter */}
                <InfluenceMeter influence={influence} />
            </div>

            {/* Footer: Pain Point */}
            {pain_point && (
                <div className="mx-3 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-red-400/70 font-medium uppercase tracking-wide">
                                Core Concern
                            </span>
                            <p className="text-xs text-red-400 mt-0.5 leading-relaxed">
                                {pain_point}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KeyPersonCard;
