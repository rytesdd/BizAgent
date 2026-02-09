/**
 * @file types.js - Type definitions for the BizAgent chat system
 * 
 * Uses JSDoc for type documentation and IDE support.
 */

// ==========================================
// Widget Types
// ==========================================

/**
 * @typedef {'snapshot' | 'gateway'} WidgetType
 */

/**
 * @typedef {Object} SnapshotWidgetData
 * @property {string} [label] - Top-left label text (e.g., "Win Rate")
 * @property {string} [title] - Fallback for label (legacy support)
 * @property {string} [heroValue] - The hero metric value (e.g., "92%", "¥1.2M")
 * @property {string} [description] - Optional subtitle under hero metric
 * @property {Record<string, string>} [kvPairs] - Bottom KV-pair list
 * @property {Record<string, any>} [metrics] - Fallback for kvPairs (legacy support)
 * @property {string} [timestamp] - When the snapshot was taken
 */

/**
 * @typedef {Object} GatewayWidgetData
 * @property {string} [id] - Unique identifier for the gateway (used for onClick routing)
 * @property {string} [icon] - Icon name (e.g., 'file', 'radar', 'database', 'security')
 * @property {string} [title] - Display title for the gateway
 * @property {string} [summary] - 2-line summary/description of the content
 * @property {string} [name] - Legacy: Gateway name (fallback for title)
 * @property {string} [status] - Connection status (active, offline, pending)
 * @property {string} [url] - Legacy: Gateway URL (fallback for summary)
 * @property {string} [description] - Legacy: Description (fallback for summary)
 * @property {Record<string, any>} [config] - Legacy: Gateway configuration
 */

/**
 * @typedef {Object} Widget
 * @property {WidgetType} type - Widget type identifier
 * @property {SnapshotWidgetData | GatewayWidgetData | any} data - Widget-specific payload
 */

// ==========================================
// Message Types
// ==========================================

/**
 * @typedef {'user' | 'ai'} MessageRole
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} key - Unique message identifier (used as React key)
 * @property {MessageRole} role - Message sender role
 * @property {string} content - Markdown text content (visible in chat bubble)
 * @property {Widget[]} [widgets] - Parsed widget objects to render below content
 * @property {string} [thoughtContent] - Chain-of-thought content (for AI messages)
 * @property {boolean} [isThinking] - Whether AI is currently thinking
 * @property {boolean} [isStreamComplete] - Whether streaming has completed
 */

// ==========================================
// Stream Parser State
// ==========================================

/**
 * @typedef {Object} WidgetParseState
 * @property {boolean} isInsideWidget - Whether parser is inside a <widget> tag
 * @property {string} widgetBuffer - Accumulated JSON content inside widget tags
 */

// Export empty object to make this a module
export { };
