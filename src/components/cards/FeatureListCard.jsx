/**
 * FeatureListCard - PRD Summary Card
 * 
 * Purpose: PRD Summary with feature list and match score.
 * Props: { doc_name, core_features, match_score, missing }
 * 
 * UI Layout:
 * - Header: Document Icon + doc_name
 * - Hero: Big match_score percentage with gradient text
 * - List: core_features as flex-wrap tags
 * - Warning: missing features in red if not "None"
 */

import React from 'react';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Get score color based on value
 */
const getScoreColor = (score) => {
    const numScore = parseInt(score) || 0;

    if (numScore >= 90) {
        return 'from-emerald-400 to-teal-400';
    }
    if (numScore >= 70) {
        return 'from-blue-400 to-cyan-400';
    }
    if (numScore >= 50) {
        return 'from-amber-400 to-orange-400';
    }
    return 'from-red-400 to-rose-400';
};

/**
 * Parse score to display format
 */
const formatScore = (score) => {
    if (!score) return '—';

    // If it's already a percentage string
    if (typeof score === 'string' && score.includes('%')) {
        return score;
    }

    // Convert to percentage
    const numScore = parseFloat(score);
    if (isNaN(numScore)) return String(score);

    // If between 0 and 1, multiply by 100
    if (numScore > 0 && numScore <= 1) {
        return `${Math.round(numScore * 100)}%`;
    }

    return `${Math.round(numScore)}%`;
};

/**
 * Check if missing value indicates actual missing features
 */
const hasMissingFeatures = (missing) => {
    if (!missing) return false;

    const normalized = String(missing).toLowerCase().trim();

    // Common "no missing" indicators
    if (/^(none|无|nil|nothing|没有|n\/a|-)$/.test(normalized)) {
        return false;
    }

    return normalized.length > 0;
};

/**
 * @param {Object} props
 * @param {Object} props.data - FeatureList data
 */
const FeatureListCard = ({ data }) => {
    if (!data) return null;

    const { doc_name, core_features = [], match_score, missing } = data;
    const scoreColor = getScoreColor(match_score);
    const displayScore = formatScore(match_score);
    const showMissing = hasMissingFeatures(missing);

    return (
        <div className="w-full rounded-xl bg-zinc-900 border border-white/10 overflow-hidden">
            {/* Header: Document Icon + Name */}
            <div className="px-4 py-3 flex items-center gap-3 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-100 truncate flex-1">
                    {doc_name || 'Untitled Document'}
                </h4>
            </div>

            {/* Hero: Match Score */}
            <div className="px-4 py-4 text-center border-b border-white/5">
                <div className={`
                    text-4xl font-bold 
                    bg-gradient-to-r ${scoreColor}
                    text-transparent bg-clip-text
                `}>
                    {displayScore}
                </div>
                <div className="text-xs text-zinc-500 mt-1">Product Fit</div>
            </div>

            {/* Core Features Tags */}
            {core_features && core_features.length > 0 && (
                <div className="px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs text-zinc-500">Core Features</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {core_features.map((feature, index) => (
                            <span
                                key={index}
                                className="text-xs px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/20"
                            >
                                {feature}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Missing Warning */}
            {showMissing && (
                <div className="px-4 pb-3">
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-red-400/70 font-medium uppercase tracking-wide">
                                    Missing
                                </span>
                                <p className="text-xs text-red-400 mt-0.5">
                                    {missing}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeatureListCard;
