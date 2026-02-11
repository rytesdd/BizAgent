import React from 'react';

/**
 * VersionSelector - 文档版本切换组件
 * 
 * 显示文档版本列表，允许用户在不同版本之间切换。
 * 样式：Pills/标签页风格，深色主题。
 */
export default function VersionSelector({ versions, activeIndex, onSwitch, rightContent }) {
    const showVersions = versions && versions.length > 1;

    // 如果即没有多个版本，也没有右侧内容，则不显示
    if (!showVersions && !rightContent) return null;

    return (
        <div className="version-selector">
            <div className="version-selector__left">
                {showVersions ? (
                    <>
                        <div className="version-selector__label">📄 文档版本</div>
                        <div className="version-selector__pills">
                            {versions.map((v, i) => (
                                <button
                                    key={v.id}
                                    className={`version-pill ${i === activeIndex ? 'version-pill--active' : ''}`}
                                    onClick={() => onSwitch(i)}
                                    title={`${v.id} - ${v.label}${v.patchCount ? ` (${v.patchCount} 处修改)` : ''}`}
                                >
                                    <span className="version-pill__id">{v.id}</span>
                                    <span className="version-pill__label">{v.label}</span>
                                    {i === versions.length - 1 && i > 0 && (
                                        <span className="version-pill__badge">最新</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    // 单一版本时的显示状态（可选）
                    <div className="version-selector__label">📄 当前版本 {versions?.[0]?.id}</div>
                )}
            </div>

            {rightContent && (
                <div className="version-selector__right">
                    {rightContent}
                </div>
            )}

            <style>{`
                .version-selector {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 8px 16px;
                    background: rgba(24, 24, 27, 0.9);
                    border-bottom: 1px solid rgba(63, 63, 70, 0.5);
                    backdrop-filter: blur(8px);
                    flex-shrink: 0;
                    min-height: 48px;
                }

                .version-selector__left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    overflow: hidden;
                }

                .version-selector__right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-left: auto;
                    flex-shrink: 0;
                }

                .version-selector__label {
                    font-size: 12px;
                    color: #71717a;
                    white-space: nowrap;
                    font-weight: 500;
                }

                .version-selector__pills {
                    display: flex;
                    gap: 6px;
                    overflow-x: auto;
                    scrollbar-width: none;
                }

                .version-selector__pills::-webkit-scrollbar {
                    display: none;
                }

                .version-pill {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 12px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    background: rgba(39, 39, 42, 0.6);
                    color: #a1a1aa;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .version-pill:hover {
                    background: rgba(39, 39, 42, 1);
                    color: #d4d4d8;
                    border-color: rgba(63, 63, 70, 0.6);
                }

                .version-pill--active {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                    border-color: rgba(59, 130, 246, 0.4);
                    font-weight: 500;
                }

                .version-pill--active:hover {
                    background: rgba(59, 130, 246, 0.2);
                    color: #60a5fa;
                    border-color: rgba(59, 130, 246, 0.5);
                }

                .version-pill__id {
                    font-weight: 600;
                    font-size: 11px;
                }

                .version-pill__label {
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .version-pill__badge {
                    font-size: 10px;
                    padding: 1px 5px;
                    border-radius: 4px;
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
}
