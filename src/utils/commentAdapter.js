/**
 * Comment Adapter - Lossless Bidirectional Conversion
 * 
 * Purpose: Translate between Frontend (anchor-based) and Backend (flat) comment structures
 * without losing any data needed for the highlighting feature.
 * 
 * Frontend Structure (V2 Feishu):
 * {
 *   id: "v2_xxx",
 *   user: "AI 审查员",
 *   content: "评论内容",
 *   anchor: {
 *     blockId: "block-section-2-intro",
 *     quote: "exact substring for highlighting"
 *   },
 *   created_at: 1234567890,
 *   type: "AI_CLIENT",
 *   replies: []
 * }
 * 
 * Backend Structure (server.js /api/comments):
 * {
 *   id: "comment_xxx",
 *   author_type: "AI_CLIENT",
 *   content: "评论内容",
 *   quoted_text: "exact substring",
 *   target_id: "block-section-2-intro",
 *   risk_level: "low",
 *   reply_content: "",
 *   created_at: "2026-02-02T..."
 * }
 */

/**
 * Convert frontend comment to backend format
 * @param {Object} frontendComment - Comment in frontend V2 format
 * @returns {Object} Comment in backend format
 */
export function toBackend(frontendComment) {
    if (!frontendComment) return null;

    return {
        // Core fields
        content: frontendComment.content || frontendComment.message || "",

        // Anchor mapping → flat fields
        quoted_text: frontendComment.anchor?.quote || "",
        target_id: frontendComment.anchor?.blockId || null,

        // Author type normalization
        author_type: normalizeAuthorType(frontendComment.type || frontendComment.author_type),

        // Optional metadata
        risk_level: frontendComment.risk_level || "low",

        // Preserve original anchor as JSON string for lossless recovery
        // Backend can store this in a future `metadata` field if needed
        _anchor_backup: frontendComment.anchor ? JSON.stringify(frontendComment.anchor) : null,
    };
}

/**
 * Convert backend comment to frontend format
 * @param {Object} backendComment - Comment from backend API
 * @returns {Object|null} Comment in frontend V2 format, or null if corrupted
 */
export function fromBackend(backendComment) {
    if (!backendComment) return null;

    // Reconstruct anchor from flat fields
    const anchor = reconstructAnchor(backendComment);

    // Skip comments without valid anchor (can't highlight without quote)
    if (!anchor) {
        console.warn("[CommentAdapter] Skipping corrupted comment (no anchor):", backendComment.id);
        return null;
    }

    return {
        id: backendComment.id,
        user: mapAuthorToUser(backendComment.author_type),
        content: backendComment.content || "",
        anchor: anchor,
        created_at: parseCreatedAt(backendComment.created_at),
        type: backendComment.author_type || "HUMAN_CLIENT",
        replies: reconstructReplies(backendComment),
    };
}

/**
 * Batch convert backend comments to frontend format
 * Filters out corrupted comments automatically
 * @param {Array} backendComments 
 * @returns {Array} Valid frontend comments
 */
export function fromBackendBatch(backendComments) {
    if (!Array.isArray(backendComments)) return [];

    return backendComments
        .map(fromBackend)
        .filter(c => c !== null);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Reconstruct anchor object from backend flat fields
 */
function reconstructAnchor(backendComment) {
    const quote = backendComment.quoted_text || backendComment.quote || "";
    const blockId = backendComment.target_id || backendComment.block_id || null;

    // If we have a backup anchor (lossless), try to parse it
    if (backendComment._anchor_backup) {
        try {
            const parsed = JSON.parse(backendComment._anchor_backup);
            if (parsed && parsed.quote) {
                return parsed; // Use the exact original
            }
        } catch (e) {
            // Ignore parse errors, fall back to reconstruction
        }
    }

    // If no quote, anchor is invalid
    if (!quote.trim()) {
        return null;
    }

    return {
        blockId: blockId || "unknown-block",
        quote: quote,
    };
}

/**
 * Normalize author type to backend format
 */
function normalizeAuthorType(type) {
    if (!type) return "HUMAN_CLIENT";

    const typeMap = {
        "AI_CLIENT": "AI_CLIENT",
        "AI_VENDOR": "AI_VENDOR",
        "HUMAN_CLIENT": "HUMAN_CLIENT",
        "HUMAN_VENDOR": "HUMAN_VENDOR",
        "client-ai": "AI_CLIENT",
        "vendor-ai": "AI_VENDOR",
        "ERROR": "SYSTEM",
    };

    return typeMap[type] || type;
}

/**
 * Map author type to display user name
 */
function mapAuthorToUser(authorType) {
    const userMap = {
        "AI_CLIENT": "AI 审查员",
        "AI_VENDOR": "AI 助手",
        "HUMAN_CLIENT": "甲方用户",
        "HUMAN_VENDOR": "乙方用户",
        "SYSTEM": "系统提示",
    };

    return userMap[authorType] || "未知用户";
}

/**
 * Parse created_at to timestamp
 */
function parseCreatedAt(createdAt) {
    if (!createdAt) return Date.now();
    if (typeof createdAt === "number") return createdAt;

    const parsed = Date.parse(createdAt);
    return isNaN(parsed) ? Date.now() : parsed;
}

/**
 * Reconstruct replies from backend format
 */
function reconstructReplies(backendComment) {
    // Backend stores reply_content as a single string
    // V2 frontend expects an array of reply objects
    const replies = [];

    if (backendComment.reply_content && backendComment.reply_content.trim()) {
        replies.push({
            id: `reply_${backendComment.id}`,
            user: mapAuthorToUser(backendComment.reply_author_type),
            content: backendComment.reply_content,
            created_at: parseCreatedAt(backendComment.reply_created_at || backendComment.created_at),
        });
    }

    return replies;
}
