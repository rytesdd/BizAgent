/**
 * MessageRenderer - Narrative Stream Renderer
 * 
 * Renders AI chat messages with interleaved content blocks:
 * - Markdown text blocks
 * - Component groups (widgets)
 * 
 * This creates a "Narrative Stream" experience similar to high-end AI tools,
 * where text and widgets flow together naturally.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import SnapshotWidget from './SnapshotWidget';
import GatewayCard from './GatewayCard';
import KeyPersonCard from './cards/KeyPersonCard';
import NotificationCard from './cards/NotificationCard';
import FeatureListCard from './cards/FeatureListCard';
import TodoCard from './cards/TodoCard';
import AlertCard from './cards/AlertCard';
import AgentControlCard from './cards/AgentControlCard';


/**
 * Widget type to component mapping
 */
const WIDGET_COMPONENTS = {
    snapshot: SnapshotWidget,
    gateway: GatewayCard,
    key_person: KeyPersonCard,
    notification: NotificationCard,
    feature_list: FeatureListCard,
    todo: TodoCard,
    alert: AlertCard,
    agent_control: AgentControlCard,
};

/**
 * Render a markdown block with rich styling
 */
const MarkdownBlock = ({ content }) => {
    if (!content) return null;

    return (
        <div className="prose prose-sm prose-invert max-w-none overflow-hidden">
            <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                    // Headers with gradient accent
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-zinc-100 mb-3 mt-2 first:mt-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-bold text-zinc-100 mb-2 mt-3 first:mt-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-zinc-100 mb-2 mt-2 first:mt-0">
                            {children}
                        </h3>
                    ),
                    // Paragraphs
                    p: ({ children }) => (
                        <p className="text-sm leading-relaxed text-zinc-300 mb-2 last:mb-0">
                            {children}
                        </p>
                    ),
                    // Strong/Bold text
                    strong: ({ children }) => (
                        <strong className="font-semibold text-zinc-100">
                            {children}
                        </strong>
                    ),
                    // Emphasis/Italic
                    em: ({ children }) => (
                        <em className="italic text-zinc-200">
                            {children}
                        </em>
                    ),
                    // Code blocks
                    code: ({ inline, children }) => (
                        inline ? (
                            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-violet-300 text-xs font-mono">
                                {children}
                            </code>
                        ) : (
                            <code className="block p-3 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-mono overflow-x-auto my-2">
                                {children}
                            </code>
                        )
                    ),
                    // Lists
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 text-sm text-zinc-300 my-2">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300 my-2">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-sm text-zinc-300">
                            {children}
                        </li>
                    ),
                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline transition-colors"
                        >
                            {children}
                        </a>
                    ),
                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-violet-500/50 pl-3 my-2 text-zinc-400 italic">
                            {children}
                        </blockquote>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

/**
 * Render a single widget
 */
const renderWidget = (widget, index, onWidgetClick) => {
    if (!widget || !widget.type) {
        console.warn('[MessageRenderer] Invalid widget:', widget);
        return null;
    }

    const WidgetComponent = WIDGET_COMPONENTS[widget.type];

    if (!WidgetComponent) {
        console.warn('[MessageRenderer] Unknown widget type:', widget.type);
        return (
            <div
                key={`widget-unknown-${index}`}
                className="rounded-lg bg-zinc-900 border border-zinc-700/50 p-3"
            >
                <div className="text-xs text-zinc-500 mb-1">
                    Unknown widget: {widget.type}
                </div>
                <pre className="text-xs text-zinc-400 overflow-x-auto">
                    {JSON.stringify(widget.data, null, 2)}
                </pre>
            </div>
        );
    }

    // For interactive widgets (like gateway), pass onClick handler
    const interactiveProps = widget.type === 'gateway' && onWidgetClick
        ? { onClick: (data) => onWidgetClick(widget.type, data) }
        : {};

    return (
        <WidgetComponent
            key={`widget-${widget.type}-${index}`}
            data={widget.data}
            {...interactiveProps}
        />
    );
};

/**
 * Render a component group (collection of widgets)
 * Supports layout hints for side-by-side or stacked layouts
 */
const ComponentGroup = ({ widgets, layoutHint, onWidgetClick }) => {
    if (!widgets || widgets.length === 0) return null;

    // Determine layout based on hint
    const isSideBySide = layoutHint === 'side-by-side' && widgets.length === 2;

    return (
        <div
            className={`
                component-group my-3
                ${isSideBySide
                    ? 'grid grid-cols-2 gap-3'
                    : 'flex flex-col gap-2'
                }
            `}
        >
            {widgets.map((widget, index) => (
                <div key={`group-widget-${index}`} className="min-w-0">
                    {renderWidget(widget, index, onWidgetClick)}
                </div>
            ))}
        </div>
    );
};

/**
 * Render a single content block based on its type
 */
const renderContentBlock = (block, index, onWidgetClick) => {
    if (!block || !block.type) {
        console.warn('[MessageRenderer] Invalid content block:', block);
        return null;
    }

    switch (block.type) {
        case 'markdown':
            return (
                <div key={`block-md-${index}`} className="content-block-markdown">
                    <MarkdownBlock content={block.content} />
                </div>
            );

        case 'component_group':
            return (
                <div key={`block-widgets-${index}`} className="content-block-widgets">
                    <ComponentGroup
                        widgets={block.widgets}
                        layoutHint={block.layoutHint}
                        onWidgetClick={onWidgetClick}
                    />
                </div>
            );

        default:
            // Attempt to render as a standalone widget
            return (
                <div key={`block-widget-${index}`} className="content-block-widget my-2">
                    {renderWidget(block, index, onWidgetClick)}
                </div>
            );
    }
};

/**
 * Main MessageRenderer Component
 * 
 * @param {Object} props
 * @param {Array} [props.contentBlocks] - Array of content blocks (new format)
 * @param {string} [props.content] - Legacy: Markdown content string
 * @param {Array} [props.widgets] - Legacy: Array of widgets
 * @param {boolean} [props.isThinking] - Whether AI is currently thinking
 * @param {Function} [props.onWidgetClick] - Callback when an interactive widget is clicked
 */
const MessageRenderer = ({
    contentBlocks,
    content,
    widgets = [],
    isThinking = false,
    onWidgetClick
}) => {
    // If contentBlocks is provided, use the new Narrative Stream format
    if (contentBlocks && Array.isArray(contentBlocks) && contentBlocks.length > 0) {
        return (
            <div className={`
                narrative-stream flex flex-col
                ${isThinking ? 'animate-pulse opacity-70' : ''}
            `}>
                {contentBlocks.map((block, index) =>
                    renderContentBlock(block, index, onWidgetClick)
                )}
            </div>
        );
    }

    // Legacy format: single content string + widgets array
    return (
        <div className={`
            flex flex-col
            ${isThinking && !content ? 'animate-pulse opacity-50' : ''}
        `}>
            {/* Markdown Content */}
            {content && <MarkdownBlock content={content} />}

            {/* Widgets (legacy format) */}
            {widgets && widgets.length > 0 && (
                <div className="widgets-container mt-3 space-y-2 overflow-hidden">
                    {widgets.map((widget, index) => renderWidget(widget, index, onWidgetClick))}
                </div>
            )}
        </div>
    );
};

export default MessageRenderer;
