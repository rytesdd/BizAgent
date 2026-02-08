import React from 'react'
import {
    Cpu,
    ChevronDown,
    RefreshCw,
    Trash2,
    Loader2,
    CheckCircle2,
} from 'lucide-react'
import { EmergencyDisconnectButton } from '../AiConfigControls'

/**
 * 模型配置面板组件
 * 
 * 从 App.jsx 提取，负责展示和管理 AI 模型配置：
 * - Provider 选择（Mock / Ollama / Kimi）
 * - Ollama 本地模型配置
 * - Kimi API 配置
 * - 配置保存
 */
function ModelConfigPanel({
    isEmbedded = false,
    isOpen = true,
    onToggle,
    config,
    onConfigChange,
    onSave,
    isLocked = false,
    isSaving = false,
    availableModels = { ollama: [], kimi: [] },
    installedOllamaModels = [],
    onRefreshOllama,
    onUnloadModel,
    isUnloading = false,
    isLoadingModels = false,
    hasChanges = false,
}) {
    return (
        <div className={`mb-6 pt-4 border-t ${isEmbedded ? 'border-[#27272a]' : 'border-slate-200'}`}>
            {/* 标题栏 - 可折叠 */}
            <button
                onClick={onToggle}
                className={`w-full mb-4 flex items-center justify-between group ${isEmbedded ? 'text-[#f4f4f5]' : 'text-slate-900'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <Cpu className={`h-5 w-5 ${isEmbedded ? 'text-[#10b981]' : 'text-emerald-500'}`} />
                    <h3 className="text-sm font-semibold">模型配置</h3>
                </div>
                <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                        } ${isEmbedded ? 'text-[#71717a]' : 'text-slate-400'}`}
                />
            </button>

            {/* 模型配置内容 */}
            {isOpen && (
                <div className="space-y-4">
                    {/* 紧急断开：立即切 Mock 并刷新，打断 API 死循环 */}
                    <EmergencyDisconnectButton />

                    {/* 提供商选择 */}
                    <div>
                        <label className={`mb-2 block text-sm font-medium ${isEmbedded ? 'text-[#a1a1aa]' : 'text-slate-700'}`}>
                            AI 提供商
                        </label>
                        <div className="flex rounded-lg border border-[#27272a] overflow-hidden">
                            {[
                                { value: 'mock', label: '🧪 Mock', desc: '测试模式' },
                                { value: 'ollama', label: '🦙 Ollama', desc: '本地模型' },
                                { value: 'kimi', label: '🌙 Kimi', desc: '云端 API' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => !isLocked && onConfigChange('provider', opt.value)}
                                    disabled={isLocked}
                                    className={`flex-1 px-3 py-2 text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${config.provider === opt.value
                                        ? 'bg-[#10b981]/20 text-[#10b981]'
                                        : 'bg-[#09090b] text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa]'
                                        } disabled:opacity-50 disabled:cursor-not-allowed border-r border-[#27272a] last:border-r-0`}
                                >
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ollama 配置 */}
                    {config.provider === 'ollama' && (
                        <div className={isEmbedded
                            ? 'space-y-3 pt-3 mt-3 border-t border-[#27272a]'
                            : 'space-y-3 p-3 rounded-lg bg-[#09090b] border border-[#27272a]'
                        }>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[#71717a]">Ollama 本地模型</span>
                                <button
                                    onClick={onRefreshOllama}
                                    disabled={isLoadingModels}
                                    className="text-xs text-[#10b981] hover:text-[#34d399] flex items-center gap-1 disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-3 w-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                                    刷新列表
                                </button>
                            </div>

                            {/* 模型选择 */}
                            <div>
                                <label className={`mb-1 block text-xs ${isEmbedded ? 'text-[#a1a1aa]' : 'text-slate-600'}`}>
                                    选择模型
                                </label>
                                <select
                                    value={config.ollama?.model || ''}
                                    onChange={(e) => onConfigChange('ollama.model', e.target.value)}
                                    disabled={isLocked}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isEmbedded
                                        ? 'border-[#27272a] bg-[#18181b] text-[#f4f4f5] focus:border-[#3f3f46] focus:ring-[#27272a]'
                                        : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-200'
                                        }`}
                                >
                                    <optgroup label="推荐模型">
                                        {availableModels.ollama?.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                    {installedOllamaModels.length > 0 && (
                                        <optgroup label="已安装模型">
                                            {installedOllamaModels.map((m) => (
                                                <option key={m.value} value={m.value}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            {/* 释放模型按钮 */}
                            <button
                                onClick={onUnloadModel}
                                disabled={isUnloading || isLocked}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isUnloading ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        释放中...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-3 w-3" />
                                        释放模型（回收内存）
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Kimi 配置 */}
                    {config.provider === 'kimi' && (
                        <div className={isEmbedded
                            ? 'space-y-3 pt-3 mt-3 border-t border-[#27272a]'
                            : 'space-y-3 p-3 rounded-lg bg-[#09090b] border border-[#27272a]'
                        }>
                            <span className="text-xs text-[#71717a]">Kimi (Moonshot) API</span>

                            {/* API Key */}
                            <div>
                                <label className={`mb-1 block text-xs ${isEmbedded ? 'text-[#a1a1aa]' : 'text-slate-600'}`}>
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={config.kimi?.apiKey || ''}
                                    onChange={(e) => onConfigChange('kimi.apiKey', e.target.value)}
                                    placeholder="sk-..."
                                    disabled={isLocked}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isEmbedded
                                        ? 'border-[#27272a] bg-[#18181b] text-[#f4f4f5] placeholder-[#52525c] focus:border-[#3f3f46] focus:ring-[#27272a]'
                                        : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-200'
                                        }`}
                                />
                            </div>

                            {/* 模型选择 */}
                            <div>
                                <label className={`mb-1 block text-xs ${isEmbedded ? 'text-[#a1a1aa]' : 'text-slate-600'}`}>
                                    选择模型
                                </label>
                                <select
                                    value={config.kimi?.model || ''}
                                    onChange={(e) => onConfigChange('kimi.model', e.target.value)}
                                    disabled={isLocked}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${isEmbedded
                                        ? 'border-[#27272a] bg-[#18181b] text-[#f4f4f5] focus:border-[#3f3f46] focus:ring-[#27272a]'
                                        : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-200'
                                        }`}
                                >
                                    {availableModels.kimi?.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Mock 模式提示 */}
                    {config.provider === 'mock' && (
                        <div className={isEmbedded
                            ? 'pt-3 mt-3 border-t border-[#27272a]'
                            : 'p-3 rounded-lg bg-[#09090b] border border-[#27272a]'
                        }>
                            <p className="text-xs text-[#71717a]">
                                🧪 Mock 模式：返回固定测试回复，适合 UI 开发调试。
                            </p>
                        </div>
                    )}

                    {/* 保存模型配置按钮 */}
                    <button
                        onClick={onSave}
                        disabled={isSaving || isLocked || !hasChanges}
                        className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isEmbedded
                            ? hasChanges
                                ? 'bg-[#10b981] text-white hover:bg-[#059669]'
                                : 'bg-[#27272a] text-[#71717a]'
                            : hasChanges
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                保存中...
                            </>
                        ) : hasChanges ? (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                应用模型配置
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                当前配置已生效
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}

export default ModelConfigPanel
