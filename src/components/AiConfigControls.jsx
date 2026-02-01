import { useState, useRef, useEffect } from 'react';

/**
 * 提示图标组件 - 用于显示配置项的帮助信息
 */
function TooltipIcon({ content }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <span
        className="cursor-help text-[#52525c] hover:text-[#71717a] text-xs ml-1"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        [?]
      </span>
      {show && (
        <div className="absolute z-50 left-0 top-5 w-64 p-3 bg-[#27272a] border border-[#3f3f46] rounded-lg text-xs text-[#a1a1aa] shadow-xl leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * 滑动条控件 - 用于 Temperature、攻击性阈值、信息饱和度
 */
export function ConfigSlider({
  label,
  tooltip,
  value,
  onChange,
  leftLabel,
  rightLabel,
  disabled,
  min = 0,
  max = 1,
  step = 0.1,
  accentColor = 'blue', // 'red' | 'blue'
}) {
  const trackColor = accentColor === 'red' ? '#ef4444' : '#3b82f6';
  const glowColor = accentColor === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';
  const glowHover = accentColor === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#e4e4e7] flex items-center">
          {label}
          {tooltip && <TooltipIcon content={tooltip} />}
        </label>
        <span className="text-xs text-[#a1a1aa] font-mono bg-[#27272a] px-2 py-0.5 rounded">
          {step >= 1 ? String(Math.round(value)) : value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{
          '--slider-thumb-color': trackColor,
          '--slider-glow': glowColor,
          '--slider-glow-hover': glowHover,
        }}
        className="w-full h-2 bg-[#27272a] rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--slider-glow)]
          [&::-webkit-slider-thumb]:transition-shadow
          [&::-webkit-slider-thumb]:hover:shadow-[0_0_0_6px_var(--slider-glow-hover)]
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${((value - min) / (max - min)) * 100}%, #27272a ${((value - min) / (max - min)) * 100}%, #27272a 100%)`,
        }}
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-[#71717a]">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 切换按钮组 - 用于推理深度（直觉反应 / 深度思维链）
 */
export function ConfigToggle({
  label,
  tooltip,
  options,
  value,
  onChange,
  disabled,
  accentColor = 'blue',
}) {
  const activeClass = accentColor === 'red'
    ? 'bg-red-500/20 text-red-400 border-red-500/50'
    : 'bg-blue-500/20 text-blue-400 border-blue-500/50';

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center">
        {label}
        {tooltip && <TooltipIcon content={tooltip} />}
      </label>
      <div className="flex rounded-lg border border-[#27272a] overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={`flex-1 px-3 py-2 text-sm transition-all duration-200 ${value === opt.value
                ? activeClass
                : 'bg-[#09090b] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 下拉选择框 - 用于知识回溯范围
 */
export function ConfigSelect({
  label,
  tooltip,
  options,
  value,
  onChange,
  disabled,
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center">
        {label}
        {tooltip && <TooltipIcon content={tooltip} />}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-[#27272a] bg-[#09090b] text-[#f4f4f5] 
            px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#165dff]/30 
            focus:border-[#165dff] disabled:opacity-50 disabled:cursor-not-allowed
            appearance-none cursor-pointer pr-10 transition-colors
            hover:border-[#3f3f46]"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#18181b]">
              {opt.label}
            </option>
          ))}
        </select>
        {/* 下拉箭头 */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className="w-4 h-4 text-[#71717a]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * 数字步进器 - 0~N 整数（如反思回路）
 */
export function ConfigStepper({ label, tooltip, value, onChange, min = 0, max = 5, disabled }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center">
        {label}
        {tooltip && <TooltipIcon content={tooltip} />}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !disabled && value > min && onChange(value - 1)}
          disabled={disabled || value <= min}
          className="w-9 h-9 rounded-lg border border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
        >
          −
        </button>
        <span className="text-sm font-mono text-[#f4f4f5] min-w-[2rem] text-center">{value}</span>
        <button
          type="button"
          onClick={() => !disabled && value < max && onChange(value + 1)}
          disabled={disabled || value >= max}
          className="w-9 h-9 rounded-lg border border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * 开关 - 用于代码解释器等布尔选项
 */
export function ConfigSwitch({ label, description, checked, onChange, disabled, accentColor = 'blue' }) {
  const activeClass = accentColor === 'red'
    ? 'bg-red-500 border-red-500'
    : 'bg-blue-500 border-blue-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium text-[#e4e4e7]">{label}</label>
          {description && <p className="text-xs text-[#71717a] mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? activeClass : 'bg-[#27272a] border-[#3f3f46]'
            }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

/**
 * 复选框组 - 用于挂载上下文等多项勾选
 */
export function ConfigCheckbox({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="rounded border-[#27272a] bg-[#09090b] text-[#165dff] focus:ring-[#165dff]/30 focus:ring-2 disabled:opacity-50"
      />
      <span className="text-sm text-[#a1a1aa] group-hover:text-[#f4f4f5]">{label}</span>
    </label>
  );
}

/**
 * 配置区块标题
 */
export function ConfigSectionTitle({ icon, title, accentColor = 'default' }) {
  const borderClass = accentColor === 'red'
    ? 'border-red-500/30'
    : accentColor === 'blue'
      ? 'border-blue-500/30'
      : 'border-[#27272a]';

  return (
    <div className={`flex items-center gap-2 text-xs text-[#a1a1aa] uppercase tracking-wider pb-2 mb-3 border-b ${borderClass}`}>
      <span className="text-base">{icon}</span>
      <span className="font-semibold">{title}</span>
    </div>
  );
}

// ============================================================
// 新增：Pro-Level 配置组件
// ============================================================

/** Client Persona Options - 甲方角色/人设选项 */
export const PERSONA_OPTIONS = [
  { value: 'Legal', label: '📜 法务审查', description: '关注合规性、条款风险和法律漏洞' },
  { value: 'CFO', label: '💰 财务总监', description: '聚焦预算、ROI 和成本效益分析' },
  { value: 'Product_Owner', label: '📋 产品负责人', description: '关注需求完整性和用户价值' },
  { value: 'Nitpicking_Boss', label: '🔍 挑剔老板', description: '事无巨细，追求完美主义' },
];

/** Client Feedback Style Options - 反馈风格选项 */
export const FEEDBACK_STYLE_OPTIONS = [
  { value: 'Constructive', label: '建设性', icon: '💡' },
  { value: 'Harsh', label: '严厉直接', icon: '⚡' },
  { value: 'Socratic', label: '苏格拉底式', icon: '❓' },
];

/** Vendor Negotiation Strategy Options - 乙方谈判策略选项 */
export const NEGOTIATION_STRATEGY_OPTIONS = [
  { value: 'Scope_Defense', label: '范围防御', icon: '🛡️', description: '坚守项目边界，避免范围蔓延' },
  { value: 'Empathy_First', label: '同理优先', icon: '🤝', description: '理解客户立场，寻求共赢方案' },
  { value: 'Technical_Authority', label: '技术权威', icon: '🔧', description: '以专业知识建立信任和说服力' },
  { value: 'Vague_Delay', label: '模糊拖延', icon: '⏳', description: '争取时间，保留回旋余地' },
];

/** Vendor Response Length Options - 回复长度选项 */
export const RESPONSE_LENGTH_OPTIONS = [
  { value: 'Concise', label: '简明扼要', icon: '📝' },
  { value: 'Detailed', label: '详细说明', icon: '📄' },
  { value: 'Formal_Letter', label: '正式公函', icon: '📮' },
];

/** 旧版：审查策略关注焦点选项（兼容） */
export const REVIEW_FOCUS_OPTIONS = ['逻辑漏洞', '合规风险', '歧义表达', '格式规范'];

/** 旧版：回复策略防御姿态选项（兼容） */
export const STANCE_OPTIONS = [
  { value: 'yield', label: '顺从 (Yield)' },
  { value: 'discuss', label: '协商 (Discuss)' },
  { value: 'assert', label: '坚持 (Assert)' },
];

/**
 * PersonaSelector - 角色/人设选择器（带描述的富下拉框）
 */
export function PersonaSelector({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = PERSONA_OPTIONS.find(p => p.value === value) || PERSONA_OPTIONS[2];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center gap-1">
        角色/人设 (Role/Persona)
        <TooltipIcon content="选择审查视角，不同角色关注不同维度" />
      </label>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left ${isOpen
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-[#27272a] hover:border-[#3f3f46] bg-[#18181b]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{selected.label.split(' ')[0]}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f4f4f5] truncate">{selected.label.split(' ').slice(1).join(' ')}</p>
              <p className="text-xs text-[#71717a] truncate">{selected.description}</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-[#71717a] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl border border-[#27272a] bg-[#18181b] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {PERSONA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${opt.value === value
                    ? 'bg-red-500/10 border-l-2 border-red-500'
                    : 'hover:bg-[#27272a] border-l-2 border-transparent'
                  }`}
              >
                <span className="text-2xl shrink-0">{opt.label.split(' ')[0]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f4f4f5]">{opt.label.split(' ').slice(1).join(' ')}</p>
                  <p className="text-xs text-[#71717a]">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FeedbackToneControl - 反馈风格分段控制器
 */
export function FeedbackToneControl({ value, onChange, disabled }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center gap-1">
        反馈风格 (Feedback Tone)
        <TooltipIcon content="选择 AI 给出反馈的语气和方式" />
      </label>
      <div className="flex rounded-xl border border-[#27272a] overflow-hidden bg-[#18181b] p-1 gap-1">
        {FEEDBACK_STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${value === opt.value
                ? 'bg-red-500/20 text-red-400 shadow-sm'
                : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#27272a]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * StrategyCard - 策略卡片组件（带图标和描述）
 */
export function StrategyCard({ option, isSelected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left group ${isSelected
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
          : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46] hover:bg-[#27272a]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-2xl transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
          {option.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold transition-colors ${isSelected ? 'text-blue-400' : 'text-[#f4f4f5]'
            }`}>
            {option.label}
          </p>
          <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
            {option.description}
          </p>
        </div>
        {isSelected && (
          <svg className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}

/**
 * StrategyCardGrid - 策略卡片网格
 */
export function StrategyCardGrid({ value, onChange, disabled }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center gap-1">
        谈判策略 (Negotiation Strategy)
        <TooltipIcon content="选择 AI 回复时采用的策略风格" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {NEGOTIATION_STRATEGY_OPTIONS.map((opt) => (
          <StrategyCard
            key={opt.value}
            option={opt}
            isSelected={value === opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * ResponseLengthSelector - 回复长度选择器
 */
export function ResponseLengthSelector({ value, onChange, disabled }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#e4e4e7] flex items-center gap-1">
        输出风格 (Output Style)
        <TooltipIcon content="控制 AI 回复的详细程度和格式" />
      </label>
      <div className="flex flex-col gap-2">
        {RESPONSE_LENGTH_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${value === opt.value
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="response_length"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => !disabled && onChange(opt.value)}
              disabled={disabled}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${value === opt.value ? 'border-blue-500' : 'border-[#52525c]'
              }`}>
              {value === opt.value && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>
            <span className="text-lg">{opt.icon}</span>
            <span className={`text-sm font-medium ${value === opt.value ? 'text-blue-400' : 'text-[#a1a1aa]'}`}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * KnowledgeContextSection - 知识上下文区块
 */
export function KnowledgeContextSection({ knowledgeBase = [], currentDocChecked = true, onToggleCurrentDoc, onAddKnowledge, disabled }) {
  return (
    <div className="space-y-3">
      <ConfigSectionTitle icon="📚" title="Reference Data (参考资料)" />
      <div className="space-y-2">
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#27272a] bg-[#18181b] cursor-pointer hover:bg-[#27272a] transition-colors">
          <input
            type="checkbox"
            checked={currentDocChecked}
            onChange={(e) => onToggleCurrentDoc?.(e.target.checked)}
            disabled={disabled}
            className="rounded border-[#3f3f46] bg-[#09090b] text-emerald-500 focus:ring-emerald-500/30 focus:ring-2"
          />
          <span className="text-lg">📄</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-[#e4e4e7]">当前文档 (Current Document)</span>
            <p className="text-xs text-[#52525c]">始终作为上下文参考</p>
          </div>
          <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">默认</span>
        </label>

        {knowledgeBase.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#27272a] bg-[#18181b]">
            <span className="text-lg">📎</span>
            <span className="text-sm text-[#a1a1aa] flex-1 truncate">{item.name || `文件 ${idx + 1}`}</span>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddKnowledge}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-[#a1a1aa] hover:bg-[#27272a]/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">添加外部知识 (Add External Knowledge)</span>
        </button>
      </div>
    </div>
  );
}

/**
 * HumanReviewToggle - 人工审核开关
 */
export function HumanReviewToggle({ checked, onChange, disabled }) {
  return (
    <div className="p-4 rounded-xl border border-[#27272a] bg-gradient-to-r from-[#18181b] to-[#27272a]/50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">👁️</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#e4e4e7]">开启人工审核 (Require Human Review)</p>
            <p className="text-xs text-[#71717a] mt-0.5">AI 回复发送前需人工确认</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${checked
              ? 'bg-amber-500 border-amber-500'
              : 'bg-[#27272a] border-[#3f3f46]'
            }`}
        >
          <span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
            }`} />
        </button>
      </div>
    </div>
  );
}

/**
 * AI 配置默认值（2026 Agentic AI 结构）
 */
export const DEFAULT_AI_CONFIG = {
  cognitive_engine: {
    thinking_budget: 0.5,
    self_reflection_loops: 2,
  },
  grounding: {
    strictness: 0.5,
    context_project_code: true,
    context_arch_doc: false,
    context_web_search: false,
  },
  agency: {
    code_sandbox_enabled: false,
    output_format: 'markdown_report',
  },
  reviewer_mode: {
    persona: 'Product_Owner',
    feedback_style: 'Constructive',
    pressure_level: 0.5,
  },
  replier_mode: {
    negotiation_strategy: 'Empathy_First',
    response_length: 'Detailed',
    grounding_doc: true,
    grounding_sop: false,
  },
  global: {
    knowledge_base: [],
    human_review_required: false,
    current_doc_enabled: true,
  },
};

/**
 * 甲方 AI 配置默认值（审查员视角）
 */
export const DEFAULT_CLIENT_AI_CONFIG = {
  cognitive_engine: {
    thinking_budget: 0.7,
    self_reflection_loops: 3,
  },
  grounding: {
    strictness: 0.6,
    context_project_code: true,
    context_arch_doc: false,
    context_web_search: false,
  },
  agency: {
    code_sandbox_enabled: false,
    output_format: 'markdown_report',
  },
  reviewer_mode: {
    persona: 'Product_Owner',
    feedback_style: 'Constructive',
    pressure_level: 0.6,
  },
  global: {
    knowledge_base: [],
    human_review_required: false,
    current_doc_enabled: true,
  },
};

/**
 * 乙方 AI 配置默认值（回复方视角）
 */
export const DEFAULT_VENDOR_AI_CONFIG = {
  cognitive_engine: {
    thinking_budget: 0.4,
    self_reflection_loops: 1,
  },
  grounding: {
    strictness: 0.4,
    context_project_code: true,
    context_arch_doc: true,
    context_web_search: false,
  },
  agency: {
    code_sandbox_enabled: false,
    output_format: 'markdown_report',
  },
  replier_mode: {
    negotiation_strategy: 'Empathy_First',
    response_length: 'Detailed',
    grounding_doc: true,
    grounding_sop: false,
  },
  global: {
    knowledge_base: [],
    human_review_required: false,
    current_doc_enabled: true,
  },
};

/**
 * AI 配置提示文案（2026 Agentic AI）
 */
export const AI_CONFIG_TOOLTIPS = {
  thinking_budget: `System 1（快）vs System 2（慢）思考。

左：即时直觉，快速响应。
右：深度推演/o1 风格，更多推理步数。`,

  self_reflection_loops: `Output verification cycles. 输出验证循环次数，0 表示不自我反思。`,

  strictness: `RAG 严格程度。

左：允许发散、联想。
右：严格遵循文档，减少幻觉。`,

  code_sandbox: `允许在沙箱中运行代码以验证 Bug，需后端支持。`,

  output_format: `Agent 输出格式：纯文本、Markdown 报告或 Json 结构化。`,

  pressure_level: `压力测试等级。

左：宽松审查，抓大放小。
右：严格审查，像素级挑刺。`,
};

/**
 * 紧急断开按钮：立即切换为 Mock 并刷新页面，用于打断 API 死循环
 */
export function EmergencyDisconnectButton() {
  const [loading, setLoading] = useState(false);

  const handleEmergencyDisconnect = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'mock' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert('已断开连接，已切换回免费 Mock 模式');
        window.location.reload();
      } else {
        alert(data.error || '切换失败，请稍后重试');
        setLoading(false);
      }
    } catch (err) {
      alert('请求失败：' + (err.message || '网络错误'));
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleEmergencyDisconnect}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium
        bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-500/50
        disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          切换中...
        </>
      ) : (
        <>🔴 紧急断开 Kimi (切换 Mock)</>
      )}
    </button>
  );
}
