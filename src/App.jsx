import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  Settings,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  ChevronDown,
  Lock,
  Brain,
  Cpu,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { eventBus, EVENTS } from './utils/eventBus'
import {
  ConfigSlider,
  ConfigSectionTitle,
  ConfigCheckbox,
  EmergencyDisconnectButton,
  DEFAULT_CLIENT_AI_CONFIG,
  DEFAULT_VENDOR_AI_CONFIG,
  PersonaSelector,
  FeedbackToneControl,
  StrategyCardGrid,
  ResponseLengthSelector,
  KnowledgeContextSection,
  HumanReviewToggle,
  AI_CONFIG_TOOLTIPS,
} from './components/AiConfigControls'

// API 请求超时（毫秒）- 后端未启动时快速失败，避免挂起导致页面假死
const API_TIMEOUT = 15000

function App({ isEmbedded = false }) {
  const [prdText, setPrdText] = useState('')
  const [prdFile, setPrdFile] = useState(null)
  const [clientPersona, setClientPersona] = useState('挑剔技术总监')
  const [vendorPersona, setVendorPersona] = useState('卑微项目经理')
  const [isSavingPersona, setIsSavingPersona] = useState(false)
  const [toast, setToast] = useState(null)
  const [isLocked, setIsLocked] = useState(false) // 生成时锁定配置
  const [clientAiConfig, setClientAiConfig] = useState(DEFAULT_CLIENT_AI_CONFIG)
  const [vendorAiConfig, setVendorAiConfig] = useState(DEFAULT_VENDOR_AI_CONFIG)
  const [activeConfigRole, setActiveConfigRole] = useState('client') // 'client' | 'vendor'
  const [showAiConfig, setShowAiConfig] = useState(true) // 默认展开 AI 配置
  const [activeTab, setActiveTab] = useState('project') // 'project' | 'ai' - Tab 切换状态

  // 模型配置状态
  const [showModelConfig, setShowModelConfig] = useState(true) // 默认展开模型配置
  const [modelConfig, setModelConfig] = useState({
    provider: 'mock',
    ollama: { model: 'qwen2-vl:7b' },
    kimi: { model: 'moonshot-v1-8k', apiKey: '' },
  })
  // 已保存的模型配置（用于比较是否有变化）
  const [savedModelConfig, setSavedModelConfig] = useState(null)
  // 默认可用模型列表（当 API 请求失败时使用）
  const [availableModels, setAvailableModels] = useState({
    ollama: [
      { value: 'qwen3-vl:8b', label: 'Qwen3-VL 8B (多模态)' },
    ],
    kimi: [
      { value: 'moonshot-v1-8k', label: 'Moonshot 8K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot 32K' },
      { value: 'moonshot-v1-128k', label: 'Moonshot 128K' },
    ],
  })
  const [installedOllamaModels, setInstalledOllamaModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isUnloading, setIsUnloading] = useState(false)
  const [isSavingModel, setIsSavingModel] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchInitialData()
    fetchAiConfig()
    fetchModelConfig()
  }, [])

  // 监听生成状态事件（用于锁定/解锁配置）
  useEffect(() => {
    const unsubscribeStart = eventBus.on(EVENTS.GENERATION_STARTED, () => {
      setIsLocked(true);
    });

    const unsubscribeComplete = eventBus.on(EVENTS.GENERATION_COMPLETED, () => {
      setIsLocked(false);
    });

    return () => {
      unsubscribeStart();
      unsubscribeComplete();
    };
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 请求失败时给出可操作提示（无法连接后端时）
  const getSaveErrorMessage = (error, fallback = '保存失败') => {
    if (error.response?.data?.error) return error.response.data.error
    if (!error.response && (error.code === 'ERR_NETWORK' || error.message?.includes('Network'))) {
      return '无法连接服务器，请先运行 npm run dev:all 或同时启动后端与前端'
    }
    return fallback
  }

  // AI 配置更新处理器（支持甲乙方）
  const handleAiConfigChange = (path, value) => {
    const setConfig = activeConfigRole === 'client' ? setClientAiConfig : setVendorAiConfig
    setConfig((prev) => {
      const keys = path.split('.')
      const newConfig = { ...prev }
      let current = newConfig
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] }
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newConfig
    })
  }

  // 获取当前选中角色的配置
  const getCurrentAiConfig = () => {
    return activeConfigRole === 'client' ? clientAiConfig : vendorAiConfig
  }

  // 获取 AI 配置（同时获取甲乙方）
  const fetchAiConfig = async () => {
    try {
      const response = await axios.get('/api/config/ai', { timeout: API_TIMEOUT })
      if (response.data.success && response.data.data) {
        const { client, vendor } = response.data.data
        if (client) {
          setClientAiConfig({ ...DEFAULT_CLIENT_AI_CONFIG, ...client })
        }
        if (vendor) {
          setVendorAiConfig({ ...DEFAULT_VENDOR_AI_CONFIG, ...vendor })
        }
      }
    } catch (error) {
      console.error('获取 AI 配置失败:', error)
    }
  }

  // 获取模型配置
  const fetchModelConfig = async () => {
    try {
      const response = await axios.get('/api/ai/config', { timeout: API_TIMEOUT })
      if (response.data.success && response.data.data) {
        const { provider, ollama, kimi, availableModels: models } = response.data.data
        const config = { provider, ollama, kimi }
        setModelConfig(config)
        setSavedModelConfig(config) // 保存服务端配置用于比较
        if (models) {
          setAvailableModels(models)
        }
      }
    } catch (error) {
      console.error('获取模型配置失败:', error)
    }
  }

  // 获取已安装的 Ollama 模型
  const fetchInstalledOllamaModels = async () => {
    setIsLoadingModels(true)
    try {
      const response = await axios.get('/api/ai/ollama-models', { timeout: API_TIMEOUT })
      if (response.data.success && response.data.data?.models) {
        setInstalledOllamaModels(response.data.data.models)
      }
    } catch (error) {
      console.error('获取 Ollama 模型列表失败:', error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  // 检查模型配置是否有变化
  const isModelConfigChanged = () => {
    if (!savedModelConfig) return true // 还没加载完成时允许保存

    // 比较 provider
    if (modelConfig.provider !== savedModelConfig.provider) return true

    // 比较 ollama 配置
    if (modelConfig.ollama?.model !== savedModelConfig.ollama?.model) return true

    // 比较 kimi 配置
    if (modelConfig.kimi?.model !== savedModelConfig.kimi?.model) return true
    if (modelConfig.kimi?.apiKey !== savedModelConfig.kimi?.apiKey) return true

    return false
  }

  // 保存模型配置
  const saveModelConfig = async () => {
    if (isLocked) {
      showToast('Agent 正在生成中，无法修改配置', 'error')
      return
    }

    setIsSavingModel(true)
    try {
      const response = await axios.post('/api/ai/config', modelConfig)
      if (response.data.success) {
        showToast('模型配置已保存')
        // 更新已保存的配置
        setSavedModelConfig({ ...modelConfig })
        // 通知状态更新
        eventBus.emit(EVENTS.CONFIG_UPDATED, { modelConfig })
      } else {
        showToast(response.data.error || '保存失败', 'error')
      }
    } catch (error) {
      showToast(getSaveErrorMessage(error, '保存失败'), 'error')
    } finally {
      setIsSavingModel(false)
    }
  }

  // 释放 Ollama 模型
  const handleUnloadModel = async () => {
    if (isUnloading) return

    setIsUnloading(true)
    try {
      const response = await axios.post('/api/ai/unload', { model: modelConfig.ollama?.model })
      if (response.data.success) {
        showToast(response.data.data.message)
      } else {
        showToast(response.data.error || '释放失败', 'error')
      }
    } catch (error) {
      showToast(error.response?.data?.error || '释放失败', 'error')
    } finally {
      setIsUnloading(false)
    }
  }

  // 更新模型配置
  const handleModelConfigChange = (path, value) => {
    setModelConfig((prev) => {
      const keys = path.split('.')
      const newConfig = { ...prev }
      if (keys.length === 1) {
        newConfig[keys[0]] = value
      } else {
        newConfig[keys[0]] = { ...newConfig[keys[0]], [keys[1]]: value }
      }
      return newConfig
    })
  }

  // 保存 AI 配置（批量保存甲乙方）
  const saveAiConfig = async () => {
    try {
      const response = await axios.post('/api/config/ai/batch', {
        client: clientAiConfig,
        vendor: vendorAiConfig,
      })
      if (response.data.success) {
        return true
      }
    } catch (error) {
      console.error('保存 AI 配置失败:', error)
    }
    return false
  }

  // 获取初始配置数据
  const fetchInitialData = async () => {
    try {
      const response = await axios.get('/api/debug/db', { timeout: API_TIMEOUT })
      if (response.data.success) {
        setClientPersona(response.data.data.personas?.client || '挑剔技术总监')
        setVendorPersona(response.data.data.personas?.vendor || '卑微项目经理')
        setPrdText(response.data.data.project_context?.prd_text || '')
      }
    } catch (error) {
      console.error('获取初始数据失败:', error)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPrdFile(file)
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.pdf')) {
      setPrdText('')
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPrdText(event.target.result ?? '')
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const handleSavePersona = async () => {
    if (isLocked) {
      showToast('Agent 正在生成中，无法修改配置', 'error')
      return
    }

    setIsSavingPersona(true)
    try {
      let finalPrdText = prdText

      // 若有已选文档（含 PDF），先上传并解析，再保存配置
      if (prdFile) {
        const formData = new FormData()
        formData.append('file', prdFile)
        const uploadRes = await axios.post('/api/file/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        if (uploadRes.data.success) {
          const { content, file_name, file_type, file_path } = uploadRes.data.data
          finalPrdText = content ?? ''
          setPrdText(finalPrdText)
          setPrdFile(null)
          eventBus.emit(EVENTS.PRD_UPDATED, {
            prdContent: finalPrdText,
            source: 'manual',
            description: file_name,
            file_type: file_type || null,
            file_path: file_path || null,
          })
        } else {
          showToast(uploadRes.data.error || '文档解析失败', 'error')
          setIsSavingPersona(false)
          return
        }
      }

      // 同时保存人设配置和 AI 配置
      const [personaResponse, aiConfigSaved] = await Promise.all([
        axios.post('/api/config/persona', {
          client: clientPersona,
          vendor: vendorPersona,
        }),
        saveAiConfig(),
      ])

      if (personaResponse.data.success) {
        showToast(aiConfigSaved ? '全部配置已保存' : '人设配置已保存')

        // 通知聊天界面配置已更新
        eventBus.emit(EVENTS.CONFIG_UPDATED, {
          clientPersona,
          vendorPersona,
          prdText: finalPrdText,
          clientAiConfig,
          vendorAiConfig,
        })
      } else {
        showToast(personaResponse.data.error || '保存失败', 'error')
      }
    } catch (error) {
      showToast(getSaveErrorMessage(error, '保存失败'), 'error')
    } finally {
      setIsSavingPersona(false)
    }
  }

  // 添加外部知识的处理函数
  const handleAddKnowledge = () => {
    showToast('外部知识库功能开发中...', 'info')
  }

  // 嵌入模式下使用暗色主题
  const containerClass = isEmbedded
    ? 'min-h-full bg-[#09090b] text-[#f4f4f5]'
    : 'min-h-screen bg-gradient-to-br from-slate-50 to-slate-100';

  return (
    <div className={containerClass}>
      {/* 锁定遮罩层 */}
      {isLocked && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#27272a]">
              <Lock className="w-8 h-8 text-[#f4f4f5] animate-pulse" />
            </div>
            <div>
              <p className="text-lg font-semibold text-[#f4f4f5]">Agent 正在生成中</p>
              <p className="text-sm text-[#71717a]">配置已锁定，请等待生成完成</p>
            </div>
            <Loader2 className="w-6 h-6 text-[#165dff] animate-spin" />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
          <div
            className={`rounded-lg border px-4 py-3 shadow-lg ${toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-green-200 bg-green-50 text-green-900'
              }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header - 嵌入模式下隐藏 */}
      {!isEmbedded && (
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="mx-auto max-w-[1800px] px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary p-2">
                  <Brain className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">AI 协作博弈剧场</h1>
                  <p className="text-xs text-muted-foreground">甲方 AI vs 乙方 AI</p>
                </div>
              </div>
              <a
                href="/chat.html"
                target="_blank"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Brain className="h-4 w-4" />
                AI 聊天界面
              </a>
            </div>
          </div>
        </header>
      )}

      {/* Main Content - Configuration Panel */}
      <div className={`mx-auto px-6 py-6 ${isEmbedded ? 'max-w-lg' : 'max-w-2xl'}`}>
        <div className={isEmbedded
          ? 'p-6'
          : 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm'
        }>
          {/* Tab 切换栏 */}
          <div className={`mb-6 flex rounded-lg border overflow-hidden ${isEmbedded ? 'border-[#27272a]' : 'border-slate-200'
            }`}>
            {/* 主 Tab：选中态为下划线，与子 Tab 色块区分 */}
            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'project'
                ? isEmbedded
                  ? 'bg-[#09090b] text-[#165dff] border-b-2 border-[#165dff] border-r border-[#27272a]'
                  : 'bg-white text-primary border-b-2 border-primary border-r border-slate-200'
                : isEmbedded
                  ? 'bg-[#09090b] text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa] border-r border-[#27272a]'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-r border-slate-200'
                }`}
            >
              <Settings className="h-4 w-4" />
              <span>项目配置</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'ai'
                ? isEmbedded
                  ? 'bg-[#09090b] text-[#165dff] border-b-2 border-[#165dff]'
                  : 'bg-white text-primary border-b-2 border-primary'
                : isEmbedded
                  ? 'bg-[#09090b] text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa]'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
            >
              <Brain className="h-4 w-4" />
              <span>AI 能力配置</span>
            </button>
          </div>

          {/* ========== 项目配置 Tab 内容 ========== */}
          {activeTab === 'project' && (
            <>
              {/* PRD Input - 仅上传文档 */}
              <div className="mb-6">
                <div className="mt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".txt,.md,.pdf"
                    className="hidden"
                    disabled={isLocked}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLocked}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isEmbedded
                      ? 'border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:bg-[#27272a]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Upload className="h-4 w-4" />
                    上传文档
                  </button>
                  {prdFile && (
                    <p className={`mt-2 text-xs ${isEmbedded ? 'text-[#71717a]' : 'text-slate-500'}`}>
                      已选择：{prdFile.name}，点击「保存配置」后解析文档
                    </p>
                  )}
                </div>
              </div>

              {/* 模型配置区块 */}
              <div className={`mb-6 pt-4 border-t ${isEmbedded ? 'border-[#27272a]' : 'border-slate-200'}`}>
                {/* 标题栏 - 可折叠 */}
                <button
                  onClick={() => setShowModelConfig(!showModelConfig)}
                  className={`w-full mb-4 flex items-center justify-between group ${isEmbedded ? 'text-[#f4f4f5]' : 'text-slate-900'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Cpu className={`h-5 w-5 ${isEmbedded ? 'text-[#10b981]' : 'text-emerald-500'}`} />
                    <h3 className="text-sm font-semibold">模型配置</h3>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${showModelConfig ? 'rotate-180' : ''
                      } ${isEmbedded ? 'text-[#71717a]' : 'text-slate-400'}`}
                  />
                </button>

                {/* 模型配置内容 */}
                {showModelConfig && (
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
                            onClick={() => !isLocked && handleModelConfigChange('provider', opt.value)}
                            disabled={isLocked}
                            className={`flex-1 px-3 py-2 text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${modelConfig.provider === opt.value
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
                    {modelConfig.provider === 'ollama' && (
                      <div className={isEmbedded
                        ? 'space-y-3 pt-3 mt-3 border-t border-[#27272a]'
                        : 'space-y-3 p-3 rounded-lg bg-[#09090b] border border-[#27272a]'
                      }>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#71717a]">Ollama 本地模型</span>
                          <button
                            onClick={fetchInstalledOllamaModels}
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
                            value={modelConfig.ollama?.model || ''}
                            onChange={(e) => handleModelConfigChange('ollama.model', e.target.value)}
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
                          onClick={handleUnloadModel}
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
                    {modelConfig.provider === 'kimi' && (
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
                            value={modelConfig.kimi?.apiKey || ''}
                            onChange={(e) => handleModelConfigChange('kimi.apiKey', e.target.value)}
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
                            value={modelConfig.kimi?.model || ''}
                            onChange={(e) => handleModelConfigChange('kimi.model', e.target.value)}
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
                    {modelConfig.provider === 'mock' && (
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
                      onClick={saveModelConfig}
                      disabled={isSavingModel || isLocked || !isModelConfigChanged()}
                      className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isEmbedded
                        ? isModelConfigChanged()
                          ? 'bg-[#10b981] text-white hover:bg-[#059669]'
                          : 'bg-[#27272a] text-[#71717a]'
                        : isModelConfigChanged()
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-200 text-slate-500'
                        }`}
                    >
                      {isSavingModel ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : isModelConfigChanged() ? (
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
            </>
          )}

          {/* ========== AI 能力配置 Tab 内容（Pro-Level 重构） ========== */}
          {activeTab === 'ai' && (
            <div className="flex flex-col min-h-0 flex-1">
              {/* 固定头部：标题 + 甲乙方切换 */}
              <div className="shrink-0 space-y-4 mb-6">
                {/* 甲乙方切换 Tab */}
                <div className="flex rounded-xl border border-[#27272a] overflow-hidden bg-[#18181b] p-1">
                  <button
                    onClick={() => !isLocked && setActiveConfigRole('client')}
                    disabled={isLocked}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-lg ${activeConfigRole === 'client'
                      ? 'bg-gradient-to-r from-red-500/20 to-red-600/10 text-red-400 shadow-sm'
                      : 'text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa]'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-lg">🔴</span>
                    <span>甲方配置</span>
                    <span className="text-xs opacity-60">(Client)</span>
                  </button>
                  <button
                    onClick={() => !isLocked && setActiveConfigRole('vendor')}
                    disabled={isLocked}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-lg ${activeConfigRole === 'vendor'
                      ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 shadow-sm'
                      : 'text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa]'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-lg">🔵</span>
                    <span>乙方配置</span>
                    <span className="text-xs opacity-60">(Vendor)</span>
                  </button>
                </div>

                {/* 角色描述 */}
                <div className={`px-4 py-3 rounded-xl border ${activeConfigRole === 'client'
                  ? 'border-red-500/20 bg-red-500/5'
                  : 'border-blue-500/20 bg-blue-500/5'
                  }`}>
                  <p className="text-xs text-[#a1a1aa]">
                    {activeConfigRole === 'client'
                      ? '💼 甲方 AI：作为客户/老板审查文档，发现问题并提出质疑'
                      : '🛠️ 乙方 AI：作为承包方回复评论，捍卫方案并解答疑问'}
                  </p>
                </div>
              </div>

              {/* 可滚动表单 */}
              <div className="max-h-[55vh] min-h-0 overflow-y-auto no-scrollbar space-y-6 pr-1">

                {/* ========== 甲方配置 (Client - Red Theme) ========== */}
                {activeConfigRole === 'client' && (
                  <>
                    {/* 审查策略区块 */}
                    <div className="space-y-5">
                      <ConfigSectionTitle
                        icon="🕵️"
                        title="Reviewer Mode (审查策略)"
                        accentColor="red"
                      />

                      {/* 角色/人设选择器 */}
                      <PersonaSelector
                        value={getCurrentAiConfig().reviewer_mode?.persona ?? 'Product_Owner'}
                        onChange={(v) => handleAiConfigChange('reviewer_mode.persona', v)}
                        disabled={isLocked}
                      />

                      {/* 压力测试等级滑块 */}
                      <ConfigSlider
                        label="压力测试等级 (Pressure Level)"
                        tooltip={AI_CONFIG_TOOLTIPS.pressure_level}
                        value={getCurrentAiConfig().reviewer_mode?.pressure_level ?? 0.5}
                        leftLabel="宽松审查"
                        rightLabel="像素级挑刺"
                        onChange={(v) => handleAiConfigChange('reviewer_mode.pressure_level', v)}
                        disabled={isLocked}
                        accentColor="red"
                      />

                      {/* 反馈风格选择器 */}
                      <FeedbackToneControl
                        value={getCurrentAiConfig().reviewer_mode?.feedback_style ?? 'Constructive'}
                        onChange={(v) => handleAiConfigChange('reviewer_mode.feedback_style', v)}
                        disabled={isLocked}
                      />
                    </div>
                  </>
                )}

                {/* ========== 乙方配置 (Vendor - Blue Theme) ========== */}
                {activeConfigRole === 'vendor' && (
                  <>
                    {/* 回复策略区块 */}
                    <div className="space-y-5">
                      <ConfigSectionTitle
                        icon="🛡️"
                        title="Replier Mode (回复策略)"
                        accentColor="blue"
                      />

                      {/* 谈判策略卡片 */}
                      <StrategyCardGrid
                        value={getCurrentAiConfig().replier_mode?.negotiation_strategy ?? 'Empathy_First'}
                        onChange={(v) => handleAiConfigChange('replier_mode.negotiation_strategy', v)}
                        disabled={isLocked}
                      />

                      {/* 输出风格选择器 */}
                      <ResponseLengthSelector
                        value={getCurrentAiConfig().replier_mode?.response_length ?? 'Detailed'}
                        onChange={(v) => handleAiConfigChange('replier_mode.response_length', v)}
                        disabled={isLocked}
                      />

                      {/* 回复依据 */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-[#e4e4e7]">回复依据 (Grounding)</label>
                        <div className="grid grid-cols-1 gap-2">
                          <ConfigCheckbox
                            label="基于本文档"
                            checked={getCurrentAiConfig().replier_mode?.grounding_doc ?? true}
                            onChange={(v) => handleAiConfigChange('replier_mode.grounding_doc', v)}
                            disabled={isLocked}
                          />
                          <ConfigCheckbox
                            label="基于历史会议纪要 (SOP)"
                            checked={getCurrentAiConfig().replier_mode?.grounding_sop ?? false}
                            onChange={(v) => handleAiConfigChange('replier_mode.grounding_sop', v)}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ========== 公共区域：知识上下文 & 人工审核 ========== */}
                <div className="pt-4 border-t border-[#27272a] space-y-5">
                  {/* 知识上下文 */}
                  <KnowledgeContextSection
                    knowledgeBase={getCurrentAiConfig().global?.knowledge_base ?? []}
                    currentDocChecked={getCurrentAiConfig().global?.current_doc_enabled ?? true}
                    onToggleCurrentDoc={(v) => handleAiConfigChange('global.current_doc_enabled', v)}
                    onAddKnowledge={handleAddKnowledge}
                    disabled={isLocked}
                  />

                  {/* 人工审核开关 */}
                  <HumanReviewToggle
                    checked={getCurrentAiConfig().global?.human_review_required ?? false}
                    onChange={(v) => handleAiConfigChange('global.human_review_required', v)}
                    disabled={isLocked}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 保存配置按钮 */}
          <button
            onClick={handleSavePersona}
            disabled={isSavingPersona || isLocked}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6 ${isEmbedded
              ? 'bg-gradient-to-r from-[#165dff] to-[#1e6fff] text-white hover:shadow-lg hover:shadow-[#165dff]/25'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
          >
            {isSavingPersona ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                保存配置
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
