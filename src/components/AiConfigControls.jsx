import { useState } from 'react';

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
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#a1a1aa] flex items-center">
          {label}
          {tooltip && <TooltipIcon content={tooltip} />}
        </label>
        <span className="text-xs text-[#71717a] font-mono bg-[#27272a] px-2 py-0.5 rounded">
          {value.toFixed(1)}
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
        className="w-full h-2 bg-[#27272a] rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#165dff]
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(22,93,255,0.2)]
          [&::-webkit-slider-thumb]:transition-shadow
          [&::-webkit-slider-thumb]:hover:shadow-[0_0_0_6px_rgba(22,93,255,0.3)]
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#165dff]
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-[#52525c]">
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
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#a1a1aa] flex items-center">
        {label}
        {tooltip && <TooltipIcon content={tooltip} />}
      </label>
      <div className="flex rounded-lg border border-[#27272a] overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={`flex-1 px-3 py-2 text-sm transition-all duration-200 ${
              value === opt.value
                ? 'bg-[#165dff] text-white font-medium'
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
      <label className="text-sm font-medium text-[#a1a1aa] flex items-center">
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
 * 配置区块标题
 */
export function ConfigSectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#71717a] uppercase tracking-wider mb-3">
      <span>{icon}</span>
      <span>{title}</span>
    </div>
  );
}

/**
 * AI 配置默认值（基础模板）
 */
export const DEFAULT_AI_CONFIG = {
  cognitive_control: {
    temperature: 0.5,
    reasoning_depth: 'intuitive', // 'intuitive' | 'chain_of_thought'
  },
  expression_control: {
    aggression_threshold: 0.3,
    information_density: 0.5,
  },
  strategy_control: {
    context_grounding: 'current_document', // 'current_document' | 'global_knowledge'
  },
};

/**
 * 甲方 AI 配置默认值（更尖锐、更发散）
 */
export const DEFAULT_CLIENT_AI_CONFIG = {
  cognitive_control: {
    temperature: 0.7,
    reasoning_depth: 'chain_of_thought',
  },
  expression_control: {
    aggression_threshold: 0.7,
    information_density: 0.5,
  },
  strategy_control: {
    context_grounding: 'current_document',
  },
};

/**
 * 乙方 AI 配置默认值（更温和、更详尽）
 */
export const DEFAULT_VENDOR_AI_CONFIG = {
  cognitive_control: {
    temperature: 0.4,
    reasoning_depth: 'intuitive',
  },
  expression_control: {
    aggression_threshold: 0.2,
    information_density: 0.7,
  },
  strategy_control: {
    context_grounding: 'current_document',
  },
};

/**
 * AI 配置提示文案
 */
export const AI_CONFIG_TOOLTIPS = {
  temperature: `决定 AI 思维的"熵值"。

低 (0.1-0.3)：逻辑绝对收敛，死扣字眼，适合寻找漏洞和逻辑硬伤。

中 (0.5)：平衡模式，兼顾逻辑与常规变通。

高 (0.7-0.9)：思维跳跃，能联想到边缘风险，适合头脑风暴，但可能产生幻觉。`,

  reasoning_depth: `决定 AI 在输出结果前的"思考步数"。

直觉反应：像即时聊天一样快速回答，适合简单的沟通。

深度思维链：强制 AI 显式地展示推导过程（如：现象→归因→风险→结论），适合复杂的 PRD 逻辑审查。`,

  aggression_threshold: `决定 AI 语言的"锋利程度"。

温和：使用"建议、或许、可以考虑"等缓冲词，侧重建设性。

尖锐：直接使用反问句、否定句，不仅指出错误，还会质疑你的专业性（模拟高压职场环境）。`,

  information_density: `决定 AI 输出的"信息密度"。

简练：只说核心结论，类似高管汇报，拒绝废话。

详尽：提供完整的背景、论据、引用和扩展建议，类似技术文档。`,

  context_grounding: `决定 AI 论证时的"依据来源"。

仅当前文档：严格限定在本次上传的 PRD 内找前后矛盾，拒绝外部发散。

全局知识库：允许调用行业标准、历史案例或竞品数据进行对比攻击。`,
};
