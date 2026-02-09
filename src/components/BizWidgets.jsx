/**
 * BizWidgets - 甲乙方 AI 输出的富 UI 组件库
 * 
 * 用于渲染来自 AI 的结构化 Widget 数据
 * 支持: Snapshot, Alert, KeyPerson, FeatureList, Todo
 */
import React from 'react';

// ============================================================================
// 图标组件
// ============================================================================
const Icons = {
    TrendUp: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    ),
    TrendDown: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
        </svg>
    ),
    AlertTriangle: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    Info: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
    CheckCircle: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ),
    User: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Target: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    ),
    Calendar: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
};

// ============================================================================
// 样式定义
// ============================================================================
const styles = {
    // Snapshot Widget 样式
    snapshot: {
        container: {
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '20px 24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            marginBottom: '16px',
        },
        value: {
            fontSize: '36px',
            fontWeight: '700',
            letterSpacing: '-1px',
        },
        label: {
            fontSize: '14px',
            color: '#9ca3af',
            marginBottom: '4px',
        },
        trend: {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: '500',
        },
    },

    // Alert Widget 样式
    alert: {
        container: {
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '16px',
            display: 'flex',
            gap: '14px',
        },
        icon: {
            flexShrink: 0,
            marginTop: '2px',
        },
        content: {
            flex: 1,
        },
        title: {
            fontWeight: '600',
            marginBottom: '6px',
            fontSize: '15px',
        },
        message: {
            fontSize: '14px',
            opacity: 0.9,
            lineHeight: '1.5',
        },
    },

    // Key Person Card 样式
    keyPerson: {
        container: {
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            marginBottom: '16px',
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '16px',
        },
        avatar: {
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
        },
        name: {
            fontSize: '18px',
            fontWeight: '600',
            color: '#f3f4f6',
        },
        role: {
            fontSize: '13px',
            color: '#9ca3af',
        },
        stanceTag: {
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            marginLeft: 'auto',
        },
        detail: {
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(0, 0, 0, 0.2)',
            marginBottom: '10px',
        },
        detailLabel: {
            fontSize: '11px',
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
        },
        detailContent: {
            fontSize: '14px',
            color: '#e5e7eb',
            lineHeight: '1.5',
        },
    },

    // Feature List 样式
    featureList: {
        container: {
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            marginBottom: '16px',
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
        },
        title: {
            fontSize: '16px',
            fontWeight: '600',
            color: '#f3f4f6',
        },
        score: {
            fontSize: '24px',
            fontWeight: '700',
            color: '#10b981',
        },
        featureItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.15)',
            marginBottom: '8px',
        },
        featureName: {
            fontSize: '14px',
            color: '#e5e7eb',
            flex: 1,
        },
        statusDot: {
            width: '10px',
            height: '10px',
            borderRadius: '50%',
        },
    },

    // Todo Card 样式
    todo: {
        container: {
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
            border: '1px solid rgba(249, 115, 22, 0.2)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
        },
        priorityTag: {
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            flexShrink: 0,
        },
        content: {
            flex: 1,
        },
        task: {
            fontSize: '15px',
            fontWeight: '500',
            color: '#f3f4f6',
            marginBottom: '8px',
            lineHeight: '1.4',
        },
        meta: {
            display: 'flex',
            gap: '16px',
            fontSize: '12px',
            color: '#9ca3af',
        },
        metaItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
        },
    },
};

// ============================================================================
// 颜色配置
// ============================================================================
const COLOR_MAP = {
    purple: { main: '#8b5cf6', light: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)' },
    green: { main: '#10b981', light: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' },
    red: { main: '#ef4444', light: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' },
    blue: { main: '#3b82f6', light: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' },
    orange: { main: '#f97316', light: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)' },
};

const ALERT_COLORS = {
    danger: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)', text: '#fca5a5', icon: '#ef4444' },
    warning: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', text: '#fcd34d', icon: '#f59e0b' },
    info: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)', text: '#93c5fd', icon: '#3b82f6' },
    success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', text: '#6ee7b7', icon: '#10b981' },
};

const STANCE_COLORS = {
    support: { bg: 'rgba(16, 185, 129, 0.2)', text: '#10b981', label: '✓ 支持' },
    neutral: { bg: 'rgba(156, 163, 175, 0.2)', text: '#9ca3af', label: '○ 中立' },
    blocker: { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: '✕ 阻碍' },
};

const PRIORITY_COLORS = {
    P0: { bg: '#ef4444', text: '#fff' },
    P1: { bg: '#f97316', text: '#fff' },
    P2: { bg: '#6b7280', text: '#fff' },
};

const STATUS_COLORS = {
    match: '#10b981',
    partial: '#f59e0b',
    gap: '#ef4444',
};

// ============================================================================
// Widget 组件
// ============================================================================

/**
 * Snapshot Widget - 数据快照卡片
 */
export function SnapshotWidget({ data }) {
    const { label = 'Metric', value = '--', trend = 'stable', color = 'purple' } = data || {};
    const colorScheme = COLOR_MAP[color] || COLOR_MAP.purple;

    const trendIcon = trend === 'up' ? <Icons.TrendUp /> : trend === 'down' ? <Icons.TrendDown /> : null;
    const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#9ca3af';

    return (
        <div style={{
            ...styles.snapshot.container,
            background: `linear-gradient(135deg, ${colorScheme.light} 0%, rgba(0,0,0,0) 100%)`,
            borderColor: colorScheme.border,
        }}>
            <div>
                <div style={styles.snapshot.label}>{label}</div>
                <div style={{ ...styles.snapshot.value, color: colorScheme.main }}>{value}</div>
            </div>
            {trendIcon && (
                <div style={{ ...styles.snapshot.trend, color: trendColor }}>
                    {trendIcon}
                    <span>{trend === 'up' ? '上升' : '下降'}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Alert Widget - 警告/提示卡片
 */
export function AlertWidget({ data }) {
    const { level = 'info', title = '提示', message = '' } = data || {};
    const colorScheme = ALERT_COLORS[level] || ALERT_COLORS.info;

    const AlertIcon = level === 'danger' || level === 'warning' ? Icons.AlertTriangle :
        level === 'success' ? Icons.CheckCircle : Icons.Info;

    return (
        <div style={{
            ...styles.alert.container,
            background: colorScheme.bg,
            border: `1px solid ${colorScheme.border}`,
        }}>
            <div style={{ ...styles.alert.icon, color: colorScheme.icon }}>
                <AlertIcon />
            </div>
            <div style={styles.alert.content}>
                <div style={{ ...styles.alert.title, color: colorScheme.text }}>{title}</div>
                <div style={{ ...styles.alert.message, color: colorScheme.text }}>{message}</div>
            </div>
        </div>
    );
}

/**
 * Key Person Card - 关键决策人卡片
 */
export function KeyPersonWidget({ data }) {
    const {
        name = '未知',
        role = '',
        stance = 'neutral',
        pain_point = '',
        strategy = ''
    } = data || {};

    const stanceStyle = STANCE_COLORS[stance] || STANCE_COLORS.neutral;

    return (
        <div style={styles.keyPerson.container}>
            <div style={styles.keyPerson.header}>
                <div style={styles.keyPerson.avatar}>
                    <Icons.User />
                </div>
                <div>
                    <div style={styles.keyPerson.name}>{name}</div>
                    <div style={styles.keyPerson.role}>{role}</div>
                </div>
                <span style={{
                    ...styles.keyPerson.stanceTag,
                    background: stanceStyle.bg,
                    color: stanceStyle.text,
                }}>
                    {stanceStyle.label}
                </span>
            </div>

            {pain_point && (
                <div style={styles.keyPerson.detail}>
                    <div style={styles.keyPerson.detailLabel}>💡 痛点分析</div>
                    <div style={styles.keyPerson.detailContent}>{pain_point}</div>
                </div>
            )}

            {strategy && (
                <div style={{ ...styles.keyPerson.detail, marginBottom: 0 }}>
                    <div style={styles.keyPerson.detailLabel}>🎯 应对策略</div>
                    <div style={styles.keyPerson.detailContent}>{strategy}</div>
                </div>
            )}
        </div>
    );
}

/**
 * Feature List Widget - 功能匹配列表卡片
 */
export function FeatureListWidget({ data }) {
    const {
        match_score = '--',
        title = '需求匹配度',
        core_features = []
    } = data || {};

    return (
        <div style={styles.featureList.container}>
            <div style={styles.featureList.header}>
                <div style={styles.featureList.title}>{title}</div>
                <div style={styles.featureList.score}>{match_score}</div>
            </div>

            {core_features.map((feature, index) => (
                <div key={index} style={styles.featureList.featureItem}>
                    <div style={{
                        ...styles.featureList.statusDot,
                        background: STATUS_COLORS[feature.status] || STATUS_COLORS.partial,
                    }} />
                    <div style={styles.featureList.featureName}>{feature.name}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * Todo Card - 待办任务卡片
 */
export function TodoWidget({ data }) {
    const {
        priority = 'P1',
        task = '',
        owner = '',
        deadline = ''
    } = data || {};

    const priorityStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.P1;

    return (
        <div style={styles.todo.container}>
            <span style={{
                ...styles.todo.priorityTag,
                background: priorityStyle.bg,
                color: priorityStyle.text,
            }}>
                {priority}
            </span>
            <div style={styles.todo.content}>
                <div style={styles.todo.task}>{task}</div>
                <div style={styles.todo.meta}>
                    {owner && (
                        <span style={styles.todo.metaItem}>
                            <Icons.User />
                            {owner}
                        </span>
                    )}
                    {deadline && (
                        <span style={styles.todo.metaItem}>
                            <Icons.Calendar />
                            {deadline}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Widget 渲染器
// ============================================================================

/**
 * 根据 Widget 类型渲染对应的组件
 * @param {object} widget - Widget 对象 { type, data/content }
 * @param {number} index - 索引
 * @returns {JSX.Element | null}
 */
export function renderWidget(widget, index) {
    if (!widget || !widget.type) return null;

    const key = `widget-${index}`;

    switch (widget.type) {
        case 'markdown':
            return (
                <div
                    key={key}
                    className="biz-markdown-block"
                    style={{ marginBottom: '12px', lineHeight: '1.6' }}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(widget.content) }}
                />
            );
        case 'snapshot':
            return <SnapshotWidget key={key} data={widget.data} />;
        case 'alert':
            return <AlertWidget key={key} data={widget.data} />;
        case 'key_person':
            return <KeyPersonWidget key={key} data={widget.data} />;
        case 'feature_list':
            return <FeatureListWidget key={key} data={widget.data} />;
        case 'todo':
            return <TodoWidget key={key} data={widget.data} />;
        default:
            console.warn(`Unknown widget type: ${widget.type}`);
            return null;
    }
}

/**
 * 批量渲染 Widget 数组
 * @param {Array} widgets - Widget 数组
 * @returns {JSX.Element}
 */
export function WidgetRenderer({ widgets }) {
    if (!Array.isArray(widgets) || widgets.length === 0) {
        return null;
    }

    return (
        <div className="biz-widget-container">
            {widgets.map((widget, index) => renderWidget(widget, index))}
        </div>
    );
}

// ============================================================================
// Markdown 解析工具（简单版本，可替换为更完整的库）
// ============================================================================

function parseMarkdown(text) {
    if (!text) return '';

    return text
        // Headers
        .replace(/^### (.*$)/gm, '<h4 style="margin: 16px 0 8px; font-size: 15px; font-weight: 600; color: #f3f4f6;">$1</h4>')
        .replace(/^## (.*$)/gm, '<h3 style="margin: 20px 0 10px; font-size: 17px; font-weight: 600; color: #f3f4f6;">$1</h3>')
        .replace(/^# (.*$)/gm, '<h2 style="margin: 24px 0 12px; font-size: 20px; font-weight: 700; color: #f3f4f6;">$1</h2>')
        // Bold & Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #f3f4f6;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Lists
        .replace(/^\- (.*$)/gm, '<li style="margin-left: 16px; color: #d1d5db;">$1</li>')
        .replace(/^\d+\. (.*$)/gm, '<li style="margin-left: 16px; color: #d1d5db;">$1</li>')
        // Line breaks
        .replace(/\n/g, '<br/>');
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
    SnapshotWidget,
    AlertWidget,
    KeyPersonWidget,
    FeatureListWidget,
    TodoWidget,
    WidgetRenderer,
    renderWidget,
};
