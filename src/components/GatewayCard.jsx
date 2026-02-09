/**
 * GatewayCard - Interactive Portal to Deeper Content
 * 
 * A clickable card that acts as a navigation gateway to detailed views.
 * High click affordance with hover effects and visual feedback.
 * 
 * Visual Style:
 * - Solid background (bg-zinc-900) with subtle border
 * - Border lights up on hover
 * - Prominent icon + title header
 * - Right-aligned chevron indicator
 * - Tag badge for context (e.g., "高匹配", "高威胁")
 * - 2-line truncated summary
 */

import React from 'react';
import { FileText, Radar, ExternalLink, ChevronRight, Zap, Database, Shield } from 'lucide-react';

/**
 * Icon mapping for different gateway types
 */
const ICON_MAP = {
    file: FileText,
    document: FileText,
    radar: Radar,
    competitor: Radar,
    external: ExternalLink,
    api: Zap,
    database: Database,
    security: Shield,
    default: FileText,
};

/**
 * Tag color mapping based on keywords
 */
const getTagStyle = (tag) => {
    if (!tag) return null;

    const normalizedTag = tag.toLowerCase();

    // Positive tags (green)
    if (/匹配|成功|完成|优|高分|正常|active|success/.test(normalizedTag)) {
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }

    // Warning/Threat tags (red/amber)
    if (/威胁|风险|危|低|失败|error|danger|threat/.test(normalizedTag)) {
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }

    // Pending/Info tags (blue)
    if (/待|处理|pending|info|processing/.test(normalizedTag)) {
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }

    // Default neutral
    return 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30';
};

/**
 * Get the appropriate icon component
 */
const getIcon = (iconName) => {
    if (!iconName) return ICON_MAP.default;
    const normalized = iconName.toLowerCase().replace(/[^a-z]/g, '');
    return ICON_MAP[normalized] || ICON_MAP.default;
};

/**
 * @param {Object} props
 * @param {Object} props.data - Gateway widget data
 * @param {Function} [props.onClick] - Click handler for the entire card
 */
const GatewayCard = ({ data, onClick }) => {
    if (!data) return null;

    const {
        id,
        icon,
        title,
        name,        // Legacy fallback
        summary,
        description, // Legacy fallback
        url,         // Legacy fallback for summary
        tag,         // New: context tag (e.g., "高匹配", "高威胁")
        status,      // Legacy - still useful for status dot
        config       // Legacy
    } = data;

    // Resolve display values with fallbacks
    const displayTitle = title || name || 'Gateway';
    const displaySummary = summary || description || url || '';
    const IconComponent = getIcon(icon);
    const hasClickHandler = typeof onClick === 'function';
    const displayTag = tag || status; // Prefer tag, fallback to status
    const tagStyle = getTagStyle(displayTag);

    const handleClick = () => {
        if (hasClickHandler) {
            onClick(data);
        } else {
            console.log('[GatewayCard] Clicked:', data.id || displayTitle);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`
                w-full text-left rounded-xl p-4 
                bg-zinc-900 
                border border-zinc-800/60 
                transition-all duration-200 ease-out
                cursor-pointer
                
                /* Hover Effects */
                hover:border-blue-500/50
                hover:bg-zinc-800/80
                hover:-translate-y-0.5
                hover:shadow-lg hover:shadow-blue-500/10
                
                /* Active/Press Effect */
                active:translate-y-0
                active:shadow-none
                
                /* Focus Ring */
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 focus:ring-offset-zinc-900
            `}
        >
            {/* Header: Icon + Title + Tag + Chevron */}
            <div className="flex items-center justify-between gap-3 mb-2">
                {/* Left: Icon + Title + Tag */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Icon Container */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <IconComponent className="w-4 h-4 text-blue-400" />
                    </div>

                    {/* Title + Tag */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-zinc-100 truncate">
                                {displayTitle}
                            </h4>
                            {/* Tag Badge */}
                            {displayTag && tagStyle && (
                                <span className={`
                                    text-[10px] font-medium px-1.5 py-0.5 rounded-full border
                                    flex-shrink-0
                                    ${tagStyle}
                                `}>
                                    {displayTag}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Chevron Indicator */}
                <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-zinc-500 transition-colors group-hover:text-blue-400" />
                </div>
            </div>

            {/* Summary: 2-line max with ellipsis */}
            {displaySummary && (
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 pl-12">
                    {displaySummary}
                </p>
            )}

            {/* Legacy: Show config as subtle metadata if present and no summary */}
            {!displaySummary && config && Object.keys(config).length > 0 && (
                <div className="mt-2 pl-12 flex flex-wrap gap-2">
                    {Object.entries(config).slice(0, 3).map(([key, value]) => (
                        <span
                            key={key}
                            className="text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded"
                        >
                            {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                    ))}
                </div>
            )}
        </button>
    );
};

export default GatewayCard;
