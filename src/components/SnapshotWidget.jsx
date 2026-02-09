/**
 * SnapshotWidget - 商机挖掘卡片
 * 
 * 基于设计稿的高端商务数据卡片样式
 * - 深色背景 (#0F0F10)
 * - 蓝色主数据 (#0E8DF6)
 * - 圆角24px
 * - 半透明KV区域
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {Object} props.data - Snapshot widget data
 */
const SnapshotWidget = ({ data }) => {
    if (!data) return null;

    const {
        // 新格式
        label,
        value,
        title,        // 项目标题
        kvPairs,      // KV 对
        // 兼容旧格式
        heroValue,
        subtext,
        description,
        metrics,
    } = data;

    // 解析显示值
    const displayLabel = label || '预估 ROI';
    const displayValue = value || heroValue || '—';
    const displayTitle = title || subtext || description;
    const displayKV = kvPairs || metrics || {};

    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '8px',
                paddingBottom: '20px',
                paddingRight: '20px',
                paddingLeft: '20px',
                background: '#0F0F10',
                borderRadius: '24px',
                overflow: 'hidden',
                boxSizing: 'border-box',
            }}
        >
            {/* 顶部：标签 + 数值 同一行，左右对齐 */}
            <div
                style={{
                    display: 'flex',
                    alignSelf: 'stretch',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexDirection: 'row',
                }}
            >
                <span
                    style={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '14px',
                        fontFamily: 'Alibaba PuHuiTi 3.0, -apple-system, sans-serif',
                        lineHeight: '20px',
                    }}
                >
                    {displayLabel}
                </span>
                <span
                    style={{
                        color: '#0E8DF6',
                        fontSize: '28px',
                        fontFamily: 'Alibaba PuHuiTi 3.0, -apple-system, sans-serif',
                        fontWeight: '600',
                        lineHeight: '36px',
                    }}
                >
                    {displayValue}
                </span>
            </div>

            {/* 项目标题区域 */}
            {displayTitle && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        flexDirection: 'column',
                        gap: '12px',
                        width: '100%',
                    }}
                >
                    {/* 分隔线 */}
                    <div
                        style={{
                            height: '1px',
                            alignSelf: 'stretch',
                            background: 'rgba(255,255,255,0.1)',
                        }}
                    />
                    {/* 标题 */}
                    <span
                        style={{
                            color: '#FFFFFF',
                            fontSize: '16px',
                            fontFamily: 'Alibaba PuHuiTi 3.0, -apple-system, sans-serif',
                            fontWeight: '600',
                            lineHeight: '22px',
                        }}
                    >
                        {displayTitle}
                    </span>
                </div>
            )}

            {/* KV Pairs 区域 */}
            {Object.keys(displayKV).length > 0 && (
                <div
                    style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        boxSizing: 'border-box',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignSelf: 'stretch',
                            justifyContent: 'flex-start',
                            alignItems: 'flex-start',
                            flexDirection: 'column',
                            gap: '6px',
                        }}
                    >
                        {Object.entries(displayKV).map(([key, val], index, arr) => (
                            <React.Fragment key={key}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignSelf: 'stretch',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        flexDirection: 'row',
                                    }}
                                >
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: '14px',
                                            fontFamily: 'Alibaba PuHuiTi 3.0, -apple-system, sans-serif',
                                            lineHeight: '20px',
                                        }}
                                    >
                                        {key}
                                    </span>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            color: '#FFFFFF',
                                            fontSize: '14px',
                                            fontFamily: 'Alibaba PuHuiTi 3.0, -apple-system, sans-serif',
                                            fontWeight: '600',
                                            lineHeight: '20px',
                                        }}
                                    >
                                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                    </span>
                                </div>
                                {/* 分隔线（最后一项不加） */}
                                {index < arr.length - 1 && (
                                    <div
                                        style={{
                                            height: '1px',
                                            alignSelf: 'stretch',
                                            background: 'rgba(255,255,255,0.1)',
                                        }}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SnapshotWidget;
