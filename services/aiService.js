/**
 * AI 服务层 - 统一接口
 * 
 * 支持三种模式：
 * - mock:   返回固定测试回复（开发 UI 用）
 * - ollama: 调用本地 Ollama
 * - kimi:   调用 Kimi (Moonshot) API
 * 
 * 支持运行时动态切换（无需重启服务）
 */

const OpenAI = require("openai");

// ============================================
// 配置常量
// ============================================

const AI_PROVIDERS = {
  MOCK: "mock",
  OLLAMA: "ollama",
  KIMI: "kimi",
};

// 可用的 Ollama 模型列表
const AVAILABLE_OLLAMA_MODELS = [
  { value: "qwen3-vl:8b", label: "Qwen3-VL 8B (多模态)", multimodal: true },
];

// 可用的 Kimi 模型列表（2026-02 从 /v1/models API 获取）
const AVAILABLE_KIMI_MODELS = [
  { value: "kimi-k2.5", label: "⭐ Kimi K2.5 (旗舰 256K·推理·多模态)" },
  { value: "kimi-latest", label: "🌙 Kimi Latest (最新稳定版)" },
  { value: "kimi-k2-thinking", label: "🧠 Kimi K2 Thinking (深度思考)" },
  { value: "kimi-k2-thinking-turbo", label: "⚡ Kimi K2 Thinking Turbo (思考加速)" },
  { value: "moonshot-v1-128k", label: "💾 Moonshot V1 128K (经典版)" },
  { value: "moonshot-v1-32k", label: "🚀 Moonshot V1 32K (高速版)" },
];

// Ollama 默认配置
const OLLAMA_DEFAULT_CONFIG = {
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  rawBaseURL: process.env.OLLAMA_BASE_URL?.replace("/v1", "") || "http://localhost:11434",
  model: process.env.OLLAMA_MODEL || "qwen3-vl:8b",
};

// Kimi (Moonshot) 默认配置（K2.5 支持 256K 上下文，适合长文档 PRD 生成与原型生成）
const KIMI_DEFAULT_CONFIG = {
  baseURL: "https://api.moonshot.cn/v1",
  model: process.env.KIMI_MODEL || "kimi-k2.5",
};

// ============================================
// 乙方人设 (Vendor Personas) - 2026 Pro Edition
// Strict Character Limit: < 100 chars
// ============================================

const VENDOR_PERSONAS = {
  // 1. Empathic Support (卑微安抚型)
  Empathy_First: `You are a Senior Customer Success Manager.
TONE: Extremely polite, patient, and empathetic.
STRATEGY: Acknowledge feelings first, then briefly explain.
CONSTRAINT (CRITICAL):
Language: Chinese.
LENGTH: MUST be under 100 characters. Aim for 50 characters.
Do not write long paragraphs. One or two warm sentences are enough.
EXAMPLE OUTPUT:
"非常抱歉给您带来困扰！关于收费问题，主要是为了保障服务器稳定性。我们会持续优化体验，感谢理解。"`,

  // 2. Strict Scope (严谨技术型)
  Scope_Defense: `You are a Lead Technical Architect.
TONE: Cold, objective, professional.
STRATEGY: Reference the PRD document directly. Reject scope creep firmly.
CONSTRAINT (CRITICAL):
Language: Chinese.
LENGTH: MUST be under 100 characters. Aim for 50 characters.
Be terse. Cut all fluff.
EXAMPLE OUTPUT:
"根据《收费公告》第2条，该功能属于定制开发范畴，不包含在当前SaaS版本中。请联系销售评估工时。"`,

  // 3. Strategic Negotiation (太极大师型)
  // Maps to "Vague_Delay" in frontend options
  Vague_Delay: `You are a Strategic Account Director.
TONE: Collaborative but non-committal.
STRATEGY: Use "Yes, but..." logic. Pivot to future phases.
CONSTRAINT (CRITICAL):
Language: Chinese.
LENGTH: MUST be under 100 characters. Aim for 50 characters.
Be vague but professional.
EXAMPLE OUTPUT:
"是个好建议！但这会影响当前排期。建议先上线核心功能，这个需求我们放入二期规划重点讨论。"`
};

// ============================================
// 运行时配置（可动态修改）
// ============================================

let runtimeConfig = {
  provider: (process.env.AI_PROVIDER || "mock").toLowerCase(),
  ollama: {
    baseURL: OLLAMA_DEFAULT_CONFIG.baseURL,
    rawBaseURL: OLLAMA_DEFAULT_CONFIG.rawBaseURL,
    model: OLLAMA_DEFAULT_CONFIG.model,
  },
  kimi: {
    baseURL: KIMI_DEFAULT_CONFIG.baseURL,
    model: KIMI_DEFAULT_CONFIG.model,
    apiKey: "", // 不在运行时配置中存储 Key，使用 getSecureApiKey 获取
  },
};

// ============================================
// 安全获取 API Key（环境变量优先）
// ============================================

/**
 * 安全获取 Kimi API Key
 * 
 * 优先级规则：
 * 1. process.env.KIMI_API_KEY - 最高优先级，始终优先使用
 * 2. runtimeConfig.kimi.apiKey - 仅当环境变量未设置时使用
 * 3. 返回空字符串 - 如果都未配置
 * 
 * @returns {string} API Key（可能为空）
 */
function getSecureApiKey(provider = "kimi") {
  if (provider === "kimi") {
    // 环境变量始终优先
    const envKey = process.env.KIMI_API_KEY;
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }
    // 降级到运行时配置（通常不会有值，因为我们不在此存储 Key）
    const runtimeKey = runtimeConfig.kimi?.apiKey;
    if (runtimeKey && runtimeKey.trim() && runtimeKey !== "********") {
      logStep("⚠️ 警告：使用运行时配置中的 API Key，建议改用 .env 文件配置");
      return runtimeKey.trim();
    }
    return "";
  }
  // DeepSeek 等其他 Provider 可在此扩展
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY || "";
  }
  return "";
}

/**
 * 检查指定 Provider 的 API Key 是否已配置
 * @param {string} provider - Provider 名称
 * @returns {boolean} 是否已配置
 */
function hasApiKey(provider = "kimi") {
  return !!getSecureApiKey(provider);
}

// Mock 回复模板（quoted_text 为 PRD 中被评论的原文片段，用于前端标黄与定位）
// target_id: Native ID Generation for strict new mode highlighting
const MOCK_RESPONSES = {
  client_review: [
    {
      content: "【风险点1】SAAS 团队版定价25积分/次，但未说明积分获取方式和成本测算依据，可能导致客户对价值认知不足。建议补充积分价值说明和ROI计算案例。",
      at_user: "产品经理",
      quoted_text: "SAAS 团队版 25积分/次",
      target_id: "ui-price-card",  // Native ID: targets the pricing card UI element
    },
    {
      content: "【风险点2】免费缓冲期至2026年2月25日，但未明确过渡期间的积分消耗是否计入正式账单周期，可能引发客户争议。",
      at_user: "后端开发",
      quoted_text: "在 2026 年 1 月 26 日至 2026 年 2 月 25 日期间，您仍可免费使用 AI 快搭和 AI 设计助手",
      target_id: "comment_1769941481927_3427",  // Native ID: targets the trial period document section
    },
    {
      content: "【风险点3】性能优化功能显示0分/次，但未说明是永久免费还是限时优惠，可能在后续版本变更时引发客户投诉。",
      at_user: "产品经理",
      quoted_text: "性能优化 0分/次",
      target_id: "comment_1769941481927_1241",  // Native ID: targets the performance optimization row
    },
  ],
  thoughts: [
    "正在初始化多模态视觉扫描模型...",
    "已识别关键 UI 区域：[定价卡片]、[功能列表]、[底部条款]...",
    "正在进行 OCR 文字提取与语义分析...",
    "深度检查：检测到“25积分”与背景对比度略低 (WCAG 标准)...",
    "逻辑校验：正在比对“免费缓冲期”日期与 SLA 协议数据库...",
    "正在生成结构化审查建议..."
  ],
  vendor_reply: "收到您的反馈，非常感谢！针对您提出的问题，我们团队已经进行了内部讨论。我们计划在下一版需求文档中补充相关细节，并会在本周五之前提供更新后的版本供您审阅。如有其他疑问，请随时沟通。",
  chat_reply: "我是 AI 助手，正在为您服务。请问有什么可以帮助您的？",
  prd_template: `# PRD 文档

## 1. 文档信息
- **版本号**: v1.0.0
- **作者**: AI 产品经理
- **创建日期**: ${new Date().toLocaleDateString('zh-CN')}
- **状态**: 草稿

## 2. 项目背景

### 2.1 业务背景
本项目旨在满足用户对于高效、便捷产品体验的需求，通过数字化手段提升业务效率。

### 2.2 项目目标
- 提升用户体验和满意度
- 优化业务流程，提高效率
- 建立可扩展的技术架构

### 2.3 预期收益
- 用户活跃度提升 30%
- 业务处理效率提升 50%
- 运营成本降低 20%

## 3. 需求范围

### 3.1 功能边界（做什么）
- 核心业务功能的完整实现
- 用户端和管理端的基础功能
- 数据统计和分析功能

### 3.2 非功能边界（不做什么）
- 暂不考虑国际化
- 暂不支持离线模式
- 暂不开放第三方 API

## 4. 用户分析

### 4.1 目标用户
- 主要用户：25-45 岁的互联网用户
- 次要用户：企业管理人员

### 4.2 用户场景
| 场景 | 描述 | 频率 |
|------|------|------|
| 场景1 | 用户日常使用核心功能 | 高频 |
| 场景2 | 管理员后台管理 | 中频 |

### 4.3 用户故事
- 作为普通用户，我希望能够快速完成主要操作，以便节省时间
- 作为管理员，我希望能够查看数据报表，以便做出决策

## 5. 功能需求

### 5.1 功能清单
| 功能模块 | 功能点 | 优先级 | 状态 |
|----------|--------|--------|------|
| 用户模块 | 用户注册 | P0 | 待开发 |
| 用户模块 | 用户登录 | P0 | 待开发 |
| 核心模块 | 核心功能A | P0 | 待开发 |
| 核心模块 | 核心功能B | P1 | 待开发 |

### 5.2 功能详细说明

#### 5.2.1 用户注册
- **功能描述**: 新用户通过手机号或邮箱注册账号
- **输入**: 手机号/邮箱、验证码、密码
- **输出**: 注册成功/失败提示
- **业务规则**: 
  - 手机号格式校验
  - 密码强度要求
- **异常处理**: 
  - 手机号已注册
  - 验证码错误

## 6. 非功能需求

### 6.1 性能需求
- 页面加载时间 < 3 秒
- API 响应时间 < 500ms
- 支持 1000 并发用户

### 6.2 安全需求
- 数据传输加密（HTTPS）
- 敏感数据脱敏
- 防 SQL 注入和 XSS 攻击

### 6.3 兼容性需求
- 支持主流浏览器（Chrome、Safari、Firefox）
- 移动端适配（iOS/Android）

### 6.4 可用性需求
- 系统可用性 > 99.9%
- 故障恢复时间 < 30 分钟

## 7. 数据需求

### 7.1 数据实体
- 用户表（User）
- 业务数据表（Business）
- 日志表（Log）

### 7.2 数据流转
用户操作 → 前端 → API → 数据库 → 返回结果

## 8. 接口需求

### 8.1 内部接口
- 用户服务 API
- 业务服务 API
- 通知服务 API

### 8.2 外部接口
- 短信服务（阿里云/腾讯云）
- 支付接口（支付宝/微信）

## 9. 项目里程碑

### 9.1 阶段划分
| 阶段 | 时间 | 交付物 |
|------|------|--------|
| 需求阶段 | 第1-2周 | PRD 文档 |
| 设计阶段 | 第3-4周 | 设计稿 |
| 开发阶段 | 第5-10周 | 可运行版本 |
| 测试阶段 | 第11-12周 | 测试报告 |
| 上线阶段 | 第13周 | 正式发布 |

## 10. 风险评估

### 10.1 技术风险
- 新技术学习成本
- 第三方服务稳定性

### 10.2 业务风险
- 需求变更频繁
- 市场竞争加剧

### 10.3 应对策略
- 预留技术调研时间
- 建立需求变更流程
- 定期市场调研

## 11. 附录

### 11.1 术语表
| 术语 | 解释 |
|------|------|
| PRD | 产品需求文档 |
| MVP | 最小可行产品 |

### 11.2 参考文档
- 竞品分析报告
- 用户调研报告
`,
};

// ============================================
// 日志工具
// ============================================

function logStep(message, meta) {
  const timestamp = new Date().toISOString();
  if (meta) {
    console.log(`[${timestamp}] [AI Service] ${message}`, meta);
    return;
  }
  console.log(`[${timestamp}] [AI Service] ${message}`);
}

// ============================================
// 获取当前 AI Provider
// ============================================

function getProvider() {
  const provider = runtimeConfig.provider;
  if (!Object.values(AI_PROVIDERS).includes(provider)) {
    logStep(`未知的 AI_PROVIDER: ${provider}，使用 mock 模式`);
    return AI_PROVIDERS.MOCK;
  }
  return provider;
}

// ============================================
// 运行时配置管理
// ============================================

/**
 * 获取当前运行时配置
 */
function getRuntimeConfig() {
  return { ...runtimeConfig };
}

/**
 * 更新运行时配置
 * @param {Object} config - 新配置
 */
function setRuntimeConfig(config) {
  if (config.provider && Object.values(AI_PROVIDERS).includes(config.provider)) {
    runtimeConfig.provider = config.provider;
  }
  if (config.ollama) {
    if (config.ollama.model) {
      runtimeConfig.ollama.model = config.ollama.model;
    }
    if (config.ollama.baseURL) {
      runtimeConfig.ollama.baseURL = config.ollama.baseURL;
      runtimeConfig.ollama.rawBaseURL = config.ollama.baseURL.replace("/v1", "");
    }
  }
  if (config.kimi) {
    if (config.kimi.model) {
      runtimeConfig.kimi.model = config.kimi.model;
    }
    // 仅接受真实密钥，脱敏占位符 "********" 不覆盖（继续使用 .env）
    if (config.kimi.apiKey && config.kimi.apiKey !== "********") {
      runtimeConfig.kimi.apiKey = config.kimi.apiKey;
    }
  }
  logStep("运行时配置已更新", { provider: runtimeConfig.provider, model: getModelName(runtimeConfig.provider) });
  return getRuntimeConfig();
}

/**
 * 初始化运行时配置（用于服务启动时从持久化存储恢复）
 * @param {Object} savedConfig - 从 db.json 读取的配置
 */
function initRuntimeConfig(savedConfig) {
  if (!savedConfig) {
    logStep("无持久化配置，使用默认配置");
    return;
  }

  // 从持久化配置恢复，但 .env 优先级更高（如果 .env 明确设置了值）
  const envProvider = process.env.AI_PROVIDER?.toLowerCase();

  // 如果 .env 是 mock（默认值）且有持久化配置，则使用持久化配置
  // 如果 .env 明确设置了非 mock 值，则以 .env 为准
  if (savedConfig.provider && Object.values(AI_PROVIDERS).includes(savedConfig.provider)) {
    // 只有当 .env 未设置或为默认 mock 时，才使用持久化配置
    if (!envProvider || envProvider === "mock") {
      runtimeConfig.provider = savedConfig.provider;
    }
  }

  if (savedConfig.ollama) {
    if (savedConfig.ollama.model) {
      runtimeConfig.ollama.model = savedConfig.ollama.model;
    }
    if (savedConfig.ollama.baseURL) {
      runtimeConfig.ollama.baseURL = savedConfig.ollama.baseURL;
      runtimeConfig.ollama.rawBaseURL = savedConfig.ollama.baseURL.replace("/v1", "");
    }
  }

  if (savedConfig.kimi) {
    if (savedConfig.kimi.model) {
      runtimeConfig.kimi.model = savedConfig.kimi.model;
    }
    // Kimi API Key 仅从 .env (KIMI_API_KEY) 读取，不从 db 恢复，避免泄露
  }

  logStep("从持久化存储恢复配置", { provider: runtimeConfig.provider, model: getModelName(runtimeConfig.provider) });
}

// ============================================
// 创建 OpenAI 兼容客户端
// ============================================

function createClient(provider) {
  switch (provider) {
    case AI_PROVIDERS.OLLAMA:
      logStep("使用 Ollama 本地模型", { baseURL: runtimeConfig.ollama.baseURL, model: runtimeConfig.ollama.model });
      return new OpenAI({
        apiKey: "ollama", // Ollama 不需要真实 key
        baseURL: runtimeConfig.ollama.baseURL,
      });

    case AI_PROVIDERS.KIMI:
      // 使用安全获取函数（环境变量优先）
      const kimiKey = getSecureApiKey("kimi");
      if (!kimiKey) {
        throw new Error("缺少 KIMI API Key，请在 .env 文件中设置 KIMI_API_KEY");
      }
      logStep("使用 Kimi (Moonshot) API", { model: runtimeConfig.kimi.model, keySource: process.env.KIMI_API_KEY ? "env" : "runtime" });
      return new OpenAI({
        apiKey: kimiKey,
        baseURL: runtimeConfig.kimi.baseURL,
      });

    default:
      return null; // Mock 模式不需要客户端
  }
}

// ============================================
// 获取模型名称
// ============================================

function getModelName(provider) {
  switch (provider) {
    case AI_PROVIDERS.OLLAMA:
      return runtimeConfig.ollama.model;
    case AI_PROVIDERS.KIMI:
      return runtimeConfig.kimi.model;
    default:
      return "mock";
  }
}

// ============================================
// 核心 AI 调用函数
// ============================================

/**
 * 调用 AI 接口
 * @param {Array} messages - OpenAI 格式的消息数组
 * @param {Object} options - 可选配置
 * @param {number} options.temperature - 温度参数
 * @param {number} options.max_tokens - 最大生成长度（PRD 建议 8192+，避免被截断）
 * @param {string} options.responseType - 响应类型: 'text' | 'json'
 * @returns {Promise<string>} AI 回复内容
 */
async function callAI(messages, options = {}) {
  const { temperature = 0.5, max_tokens, responseType = "text" } = options;
  const provider = getProvider();

  logStep(`调用 AI [${provider}]`, { messageCount: messages.length, temperature });

  // Mock 模式
  if (provider === AI_PROVIDERS.MOCK) {
    return handleMockRequest(messages, responseType);
  }

  // 真实 AI 调用
  const client = createClient(provider);
  const model = getModelName(provider);

  const createParams = { model, messages, temperature };
  if (max_tokens != null) createParams.max_tokens = max_tokens;
  try {
    const response = await client.chat.completions.create(createParams);

    const content = response?.choices?.[0]?.message?.content || "";
    logStep("AI 返回成功", { length: content.length });
    return content;
  } catch (error) {
    logStep("AI 调用失败", { error: error.message });
    throw error;
  }
}

/**
 * 流式调用 AI 接口（异步生成器，逐 chunk 产出）
 * @param {Array} messages - OpenAI 格式的消息数组
 * @param {Object} options - 可选配置
 * @param {number} options.temperature - 温度参数
 * @param {number} options.max_tokens - 最大生成长度（PRD 建议 8192+）
 * @yields {string} 每个 delta 文本片段
 */
async function* callAIStream(messages, options = {}) {
  const { temperature = 0.5, max_tokens } = options;
  const provider = getProvider();

  logStep(`流式调用 AI [${provider}]`, { messageCount: messages.length, temperature });

  if (provider === AI_PROVIDERS.MOCK) {
    yield* handleMockRequestStream(messages);
    return;
  }

  const client = createClient(provider);
  const model = getModelName(provider);
  const createParams = { model, messages, temperature, stream: true };
  if (max_tokens != null) createParams.max_tokens = max_tokens;
  try {
    const stream = await client.chat.completions.create(createParams);

    for await (const chunk of stream) {
      const text = chunk?.choices?.[0]?.delta?.content ?? "";
      if (text) yield text;
    }
    logStep("AI 流式返回完成");
  } catch (error) {
    logStep("AI 流式调用失败", { error: error.message });
    throw error;
  }
}

// ============================================
// Mock 模式处理
// ============================================

function handleMockRequest(messages, responseType) {
  // 根据消息内容推断请求类型
  const lastMessage = messages[messages.length - 1]?.content || "";

  // 模拟延迟 (500ms - 1500ms)，PRD 生成稍长 (1500ms - 3000ms)
  const isPrdGeneration = lastMessage.includes("PRD") || lastMessage.includes("prd") || lastMessage.includes("需求文档");
  const delay = isPrdGeneration
    ? Math.floor(Math.random() * 1500) + 1500
    : Math.floor(Math.random() * 1000) + 500;

  return new Promise((resolve) => {
    setTimeout(() => {
      if (lastMessage.includes("审查") || lastMessage.includes("风险")) {
        // 甲方审查请求
        logStep("Mock 模式: 返回甲方审查回复");
        resolve(JSON.stringify(MOCK_RESPONSES.client_review));
      } else if (lastMessage.includes("回复") || lastMessage.includes("乙方")) {
        // 乙方回复请求
        logStep("Mock 模式: 返回乙方回复");
        resolve(MOCK_RESPONSES.vendor_reply);
      } else if (lastMessage.includes("生成") && isPrdGeneration) {
        // PRD 生成请求
        logStep("Mock 模式: 返回 PRD 模板");
        resolve(MOCK_RESPONSES.prd_template);
      } else {
        // 通用聊天
        logStep("Mock 模式: 返回通用回复");
        resolve(MOCK_RESPONSES.chat_reply);
      }
    }, delay);
  });
}

/**
 * Mock 模式流式响应：按行或按块产出 PRD 模板，带小延迟
 * @param {Array} messages - 消息（用于判断是否为 PRD）
 */
async function* handleMockRequestStream(messages) {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const isPrd = lastMessage.includes("PRD") || lastMessage.includes("prd") || lastMessage.includes("需求文档");
  if (!isPrd) {
    yield MOCK_RESPONSES.chat_reply;
    return;
  }
  const text = MOCK_RESPONSES.prd_template;
  const chunkSize = 80;
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
    await new Promise((r) => setTimeout(r, 30));
  }
}

/**
 * Mock 模式流式审查响应：产出 <thinking>...</thinking> 标签后跟 JSON 数组
 * 用于测试前端 Chain-of-Thought UI 而无需消耗 API tokens
 * @yields {string} 每个 delta 文本片段
 */
async function* handleMockReviewStream() {
  logStep("Mock 模式: 流式审查开始");

  // 1. 产出 <thinking> 开始标签
  yield "<thinking>\n";
  await new Promise((r) => setTimeout(r, 200));

  // 2. 逐行产出思维过程
  for (const thought of MOCK_RESPONSES.thoughts) {
    yield thought + "\n";
    await new Promise((r) => setTimeout(r, 400)); // 模拟思考延迟
  }

  // 3. 产出 </thinking> 结束标签
  yield "</thinking>\n";
  await new Promise((r) => setTimeout(r, 200));

  // 4. 产出 JSON 数组（分块）
  const jsonStr = JSON.stringify(MOCK_RESPONSES.client_review, null, 2);
  const chunkSize = 100;
  for (let i = 0; i < jsonStr.length; i += chunkSize) {
    yield jsonStr.slice(i, i + chunkSize);
    await new Promise((r) => setTimeout(r, 30));
  }

  logStep("Mock 模式: 流式审查完成");
}

// ============================================
// 业务封装函数
// ============================================

/**
 * 甲方审查文档
 * @param {string} prdText - PRD 文档内容
 * @param {string} persona - 甲方人格设定 (from db.personas.client or config)
 * @param {Object} aiConfig - AI 配置 (from db.client_ai_config)
 * @returns {Promise<Array>} 审查评论数组
 */
async function reviewDocument(prdText, persona, aiConfig = {}) {
  const temperature = aiConfig?.cognitive_engine?.thinking_budget ?? 0.7;
  const reviewerMode = aiConfig?.reviewer_mode || {};

  // 1. 解析配置参数
  const feedbackStyle = reviewerMode.feedback_style || "Constructive"; // Constructive, Harsh, Socratic
  const pressureLevel = reviewerMode.pressure_level ?? 0.6; // 0.0 - 1.0

  // 2. 构建风格指令
  let stylePrompt = "";
  switch (feedbackStyle) {
    case "Harsh":
      stylePrompt = "你的风格是非常严厉和直接的。不要客气，直接指出愚蠢的错误。关注每一个细节，即使是微小的问题也不要放过。";
      break;
    case "Socratic":
      stylePrompt = "你的风格是苏格拉底式的。不要直接给出结论，而是通过提问来引导乙方思考潜在的风险。多用反问句。";
      break;
    case "Constructive":
    default:
      stylePrompt = "你的风格是建设性的。在指出问题的同时，尽量给出改进的方向。语气要专业且客观。";
      break;
  }

  // 3. 构建压力/严格程度对于 risk 阈值的指令
  let pressurePrompt = "";
  if (pressureLevel > 0.8) {
    pressurePrompt = "请用【极度严格】的标准审查。任何模糊不清、逻辑不严密、或者可能导致歧义的地方都必须指出。宁可错杀，不可放过。至少找出 5-8 个风险点。";
  } else if (pressureLevel < 0.3) {
    pressurePrompt = "请用【宽松】的标准审查。只关注那些会导致项目失败的重大逻辑漏洞或严重合规风险。忽略细枝末节。找出 1-3 个最关键的风险点即可。";
  } else {
    pressurePrompt = "请用【标准】的专业标准审查。关注逻辑漏洞、合规风险和需求不明确的地方。找出 3-5 个有价值的风险点。";
  }

  const systemPrompt = `你是一个严格的技术审查员。你必须只返回严格 JSON 数组，不要添加任何额外文本。
${stylePrompt}
${pressurePrompt}`;

  const userPrompt = [
    `你是一个审查员，人格设定：${persona}`,
    "请审查以下 PRD 文档，找出其中的风险点。",
    "对于每个风险点：1) 写清问题描述；2) 判断应该 @谁 (UI设计/后端开发/产品经理)；3) 必须从 PRD 中**原样复制**被评论的那一句或一小段原文，作为 quoted_text（用于文档内定位与高亮）。",
    "输出格式（严格 JSON 数组）：",
    '[{ "content": "问题描述...", "at_user": "角色", "quoted_text": "从 PRD 中原样复制的被评论原文" }]',
    "",
    "PRD 文档内容：",
    prdText,
  ].join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await callAI(messages, { temperature, responseType: "json" });
  return parseJsonArray(response);
}

/**
 * 甲方审查文档 - 流式版本（Chain-of-Thought + SSE）
 * 
 * 产出格式：
 * <thinking>
 * 步骤1: 分析...
 * 步骤2: 检查...
 * </thinking>
 * [{ "content": "...", "at_user": "...", "quoted_text": "..." }, ...]
 * 
 * @param {string} prdText - PRD 文档内容
 * @param {string} persona - 甲方人格设定
 * @param {Object} aiConfig - AI 配置
 * @yields {string} 每个 delta 文本片段
 */
async function* reviewDocumentStream(prdText, persona, aiConfig = {}) {
  const temperature = aiConfig?.cognitive_engine?.thinking_budget ?? 0.7;
  const reviewerMode = aiConfig?.reviewer_mode || {};
  const provider = getProvider();

  logStep("开始流式审查文档（Chain-of-Thought）", { provider, prdLength: prdText.length });

  // Mock 模式：使用专用的 Mock 流式审查
  if (provider === AI_PROVIDERS.MOCK) {
    yield* handleMockReviewStream();
    return;
  }

  // 1. 解析配置参数
  const feedbackStyle = reviewerMode.feedback_style || "Constructive";
  const pressureLevel = reviewerMode.pressure_level ?? 0.6;

  // 2. 构建风格指令
  let stylePrompt = "";
  switch (feedbackStyle) {
    case "Harsh":
      stylePrompt = "你的风格是非常严厉和直接的。不要客气，直接指出愚蠢的错误。关注每一个细节，即使是微小的问题也不要放过。";
      break;
    case "Socratic":
      stylePrompt = "你的风格是苏格拉底式的。不要直接给出结论，而是通过提问来引导乙方思考潜在的风险。多用反问句。";
      break;
    case "Constructive":
    default:
      stylePrompt = "你的风格是建设性的。在指出问题的同时，尽量给出改进的方向。语气要专业且客观。";
      break;
  }

  // 3. 构建压力/严格程度指令
  let pressurePrompt = "";
  if (pressureLevel > 0.8) {
    pressurePrompt = "请用【极度严格】的标准审查。任何模糊不清、逻辑不严密、或者可能导致歧义的地方都必须指出。宁可错杀，不可放过。至少找出 5-8 个风险点。";
  } else if (pressureLevel < 0.3) {
    pressurePrompt = "请用【宽松】的标准审查。只关注那些会导致项目失败的重大逻辑漏洞或严重合规风险。忽略细枝末节。找出 1-3 个最关键的风险点即可。";
  } else {
    pressurePrompt = "请用【标准】的专业标准审查。关注逻辑漏洞、合规风险和需求不明确的地方。找出 3-5 个有价值的风险点。";
  }

  // 4. 构建 Chain-of-Thought 系统提示（关键修改）
  const systemPrompt = `你是一个严格的技术审查员。
${stylePrompt}
${pressurePrompt}

**重要：你必须严格遵循以下输出格式：**

1. 首先，在 <thinking>...</thinking> XML 标签内，逐步分析文档：
   - 识别文档的关键区域和内容
   - 检查逻辑一致性和潜在风险
   - 评估每个问题的严重程度

2. 然后，在 </thinking> 标签之后，输出严格的 JSON 数组：
   [{ "content": "问题描述...", "at_user": "角色", "quoted_text": "从 PRD 中原样复制的被评论原文" }]

注意：
- <thinking> 标签内的内容用中文书写，展示你的思考过程
- JSON 数组必须在 </thinking> 标签之外
- 不要在 JSON 外添加任何其他文本`;

  const userPrompt = [
    `你是一个审查员，人格设定：${persona}`,
    "请审查以下 PRD 文档，找出其中的风险点。",
    "对于每个风险点：1) 写清问题描述；2) 判断应该 @谁 (UI设计/后端开发/产品经理)；3) 必须从 PRD 中**原样复制**被评论的那一句或一小段原文，作为 quoted_text（用于文档内定位与高亮）。",
    "",
    "PRD 文档内容：",
    prdText,
  ].join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // 5. 调用流式 AI
  yield* callAIStream(messages, { temperature, max_tokens: 4096 });
  logStep("流式审查完成");
}

/**
 * 乙方回复评论
 * @param {string} commentContent - 甲方评论内容
 * @param {string} prdText - PRD 上下文
 * @param {string} persona - 乙方人格设定
 * @param {Object} aiConfig - AI 配置
 * @returns {Promise<string>} 回复内容
 */
async function replyToComment(commentContent, prdText, persona, aiConfig = {}) {
  const temperature = aiConfig?.cognitive_engine?.thinking_budget ?? 0.4;
  const replierMode = aiConfig?.replier_mode || {};

  // 1. 解析配置参数
  const negotiationStrategy = replierMode.negotiation_strategy || "Empathy_First";

  // 2. 获取 System Prompt (使用新的 VENDOR_PERSONAS 常量)
  let systemPrompt = VENDOR_PERSONAS[negotiationStrategy];

  // 兜底策略：如果未通过 Strategy 匹配到（例如 Technical_Authority），
  // 暂时映射到最为接近的 Scope_Defense (严谨技术型)，以保证字数限制生效
  if (!systemPrompt) {
    if (negotiationStrategy === "Technical_Authority") {
      systemPrompt = VENDOR_PERSONAS.Scope_Defense;
    } else {
      systemPrompt = VENDOR_PERSONAS.Empathy_First;
    }
  }

  const userPrompt = [
    `甲方刚才说：${commentContent}`,
    // 注意：Vendor Personas 已包含角色定义，此处仅保留上下文提示
    "作为乙方，请根据 PRD 上下文生成回复。",
    "请严格遵循 System Prompt 中的策略和字数限制（<100字）。",
    "",
    "PRD 上下文：",
    prdText ? prdText.slice(0, 3000) + "..." : "(空)", // 截断防止 token 溢出
  ].join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  return callAI(messages, { temperature });
}

/**
 * 通用聊天
 * @param {string} userMessage - 用户消息
 * @param {Array} history - 历史消息
 * @param {string} roleContext - 角色上下文（可选）
 * @returns {Promise<string>} AI 回复
 */
async function chat(userMessage, history = [], roleContext = "") {
  const basePrompt = "你是一个智能助手，帮助用户完成文档审查和项目协作任务。请用中文回复。";
  const systemPrompt = roleContext ? `${roleContext}\n\n${basePrompt}` : basePrompt;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  return callAI(messages, { temperature: 0.7 });
}

/**
 * 生成 PRD 文档
 * @param {string} description - 用户提供的需求描述
 * @param {string} persona - 人格设定（可选）
 * @returns {Promise<string>} 生成的 PRD 文档（Markdown 格式）
 */
async function generatePRD(description, persona = "") {
  logStep("开始生成 PRD 文档", { descriptionLength: description.length, persona });

  const systemPrompt = `你是一位资深的产品经理，擅长撰写清晰、完整、结构化的产品需求文档（PRD）。
你需要根据用户提供的需求描述，生成一份专业的 PRD 文档。

重要约束：
1. 必须紧扣用户的需求描述展开，不要臆造与需求无关的行业或产品（例如用户没说教育就不要写在线教育平台）。
2. 内容要具体、可执行，禁止泛泛而谈（如“提升用户体验”“提高效率”等空洞表述需配合具体指标或场景）。
3. 若用户描述较简略，可合理推断并注明“基于当前描述的合理推断”，但不要脱离描述编造全新产品。

输出要求：
1. 使用 Markdown 格式
2. 结构清晰，包含完整的章节
3. 语言专业但易于理解
4. 适当补充用户未明确但合理的细节

${persona ? `你的人格设定：${persona}` : ''}`;

  const userPrompt = `请根据以下需求描述，生成一份完整的 PRD 文档：

${description}

请按照以下结构输出：

# PRD 文档

## 1. 文档信息
- 版本号
- 作者
- 创建日期
- 状态

## 2. 项目背景
### 2.1 业务背景
### 2.2 项目目标
### 2.3 预期收益

## 3. 需求范围
### 3.1 功能边界（做什么）
### 3.2 非功能边界（不做什么）

## 4. 用户分析
### 4.1 目标用户
### 4.2 用户场景
### 4.3 用户故事

## 5. 功能需求
### 5.1 功能清单
### 5.2 功能详细说明
（为每个功能提供：功能描述、输入/输出、业务规则、异常处理）

## 6. 非功能需求
### 6.1 性能需求
### 6.2 安全需求
### 6.3 兼容性需求
### 6.4 可用性需求

## 7. 数据需求
### 7.1 数据实体
### 7.2 数据流转

## 8. 接口需求
### 8.1 内部接口
### 8.2 外部接口

## 9. 项目里程碑
### 9.1 阶段划分
### 9.2 交付物

## 10. 风险评估
### 10.1 技术风险
### 10.2 业务风险
### 10.3 应对策略

## 11. 附录
### 11.1 术语表
### 11.2 参考文档`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const prdContent = await callAI(messages, { temperature: 0.6, max_tokens: 8192 });
  logStep("PRD 文档生成完成", { length: prdContent.length });

  return prdContent;
}

/**
 * 流式生成 PRD 文档（异步生成器，逐 chunk 产出）
 * @param {string} description - 用户提供的需求描述
 * @param {string} persona - 人格设定（可选）
 * @yields {string} 每个 delta 文本片段
 */
async function* generatePRDStream(description, persona = "") {
  logStep("开始流式生成 PRD 文档", { descriptionLength: description.length, persona });

  const systemPrompt = `你是一位资深的产品经理，擅长撰写清晰、完整、结构化的产品需求文档（PRD）。
你需要根据用户提供的需求描述，生成一份专业的 PRD 文档。

重要约束：
1. 必须紧扣用户的需求描述展开，不要臆造与需求无关的行业或产品（例如用户没说教育就不要写在线教育平台）。
2. 内容要具体、可执行，禁止泛泛而谈（如“提升用户体验”“提高效率”等空洞表述需配合具体指标或场景）。
3. 若用户描述较简略，可合理推断并注明“基于当前描述的合理推断”，但不要脱离描述编造全新产品。

输出要求：
1. 使用 Markdown 格式
2. 结构清晰，包含完整的章节
3. 语言专业但易于理解
4. 适当补充用户未明确但合理的细节

${persona ? `你的人格设定：${persona}` : ''}`;

  const userPrompt = `请根据以下需求描述，生成一份完整的 PRD 文档：

${description}

请按照以下结构输出：

# PRD 文档

## 1. 文档信息
- 版本号
- 作者
- 创建日期
- 状态

## 2. 项目背景
### 2.1 业务背景
### 2.2 项目目标
### 2.3 预期收益

## 3. 需求范围
### 3.1 功能边界（做什么）
### 3.2 非功能边界（不做什么）

## 4. 用户分析
### 4.1 目标用户
### 4.2 用户场景
### 4.3 用户故事

## 5. 功能需求
### 5.1 功能清单
### 5.2 功能详细说明
（为每个功能提供：功能描述、输入/输出、业务规则、异常处理）

## 6. 非功能需求
### 6.1 性能需求
### 6.2 安全需求
### 6.3 兼容性需求
### 6.4 可用性需求

## 7. 数据需求
### 7.1 数据实体
### 7.2 数据流转

## 8. 接口需求
### 8.1 内部接口
### 8.2 外部接口

## 9. 项目里程碑
### 9.1 阶段划分
### 9.2 交付物

## 10. 风险评估
### 10.1 技术风险
### 10.2 业务风险
### 10.3 应对策略

## 11. 附录
### 11.1 术语表
### 11.2 参考文档`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  yield* callAIStream(messages, { temperature: 0.6, max_tokens: 8192 });
  logStep("PRD 流式生成完成");
}

/** 单次发给模型的文档长度上限（字符），避免超长卡死 */
const REFORMAT_MAX_CHARS = 8000;

/**
 * 用本地模型对文档重新排版：分段、加小标题、列表等，意思不变
 * @param {string} rawText - 从 PDF 等提取的原始文本
 * @returns {Promise<string>} 重新排版后的文档
 */
async function reformatDocument(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("没有可整理的文档内容");
  }
  const text = rawText.length > REFORMAT_MAX_CHARS
    ? rawText.slice(0, REFORMAT_MAX_CHARS) + "\n\n[后文过长已省略，仅整理前 " + REFORMAT_MAX_CHARS + " 字]"
    : rawText;
  logStep("开始用 AI 重新整理文档", { inputLength: rawText.length, sentLength: text.length });

  const systemPrompt = "你是一个文档整理助手。把从 PDF 等提取的杂乱文本重新排版成结构清晰、分段合理、易读的文档。只做格式与结构优化（分段、小标题、列表等），不改变原意，不增删关键信息。用中文输出，使用 Markdown 格式。";
  const userPrompt = `请对以下内容重新排版（分段、加小标题、列表等，意思不变）：\n\n${text}`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const content = await callAI(messages, { temperature: 0.4, max_tokens: 8192 });
  logStep("文档重新整理完成", { outputLength: content.length });
  return content;
}

/**
 * 流式重新整理文档（逐 chunk 产出，供 SSE 使用）
 * @param {string} rawText - 从 PDF 等提取的原始文本
 * @yields {string} 每个 delta 文本片段
 */
async function* reformatDocumentStream(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("没有可整理的文档内容");
  }
  const text = rawText.length > REFORMAT_MAX_CHARS
    ? rawText.slice(0, REFORMAT_MAX_CHARS) + "\n\n[后文过长已省略，仅整理前 " + REFORMAT_MAX_CHARS + " 字]"
    : rawText;
  logStep("开始流式重新整理文档", { inputLength: rawText.length, sentLength: text.length });

  const systemPrompt = "你是一个文档整理助手。把从 PDF 等提取的杂乱文本重新排版成结构清晰、分段合理、易读的文档。只做格式与结构优化（分段、小标题、列表等），不改变原意，不增删关键信息。用中文输出，使用 Markdown 格式。";
  const userPrompt = `请对以下内容重新排版（分段、加小标题、列表等，意思不变）：\n\n${text}`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  yield* callAIStream(messages, { temperature: 0.4, max_tokens: 8192 });
  logStep("流式重新整理完成");
}

/**
 * 检测消息是否为 PRD 生成指令
 * @param {string} content - 用户消息内容
 * @returns {Object|null} 如果是生成指令返回 { isCommand: true, description }，否则返回 null
 */
function detectPRDCommand(content) {
  // PRD 生成关键词列表
  const prdKeywords = [
    "生成PRD",
    "生成prd",
    "生成Prd",
    "写一个PRD",
    "写一个prd",
    "写个PRD",
    "写个prd",
    "帮我生成PRD",
    "帮我生成prd",
    "创建PRD",
    "创建prd",
    "帮我写PRD",
    "帮我写prd",
    "出一份PRD",
    "出一份prd",
    "生成需求文档",
    "写需求文档",
  ];

  // 检查是否包含任一关键词
  const matchedKeyword = prdKeywords.find(keyword => content.includes(keyword));

  if (!matchedKeyword) {
    return null;
  }

  // 提取描述内容：移除关键词前后的常见连接词
  let description = content;

  // 常见的前缀模式
  const prefixPatterns = [
    /^.*?帮我/,
    /^.*?请/,
    /^.*?麻烦/,
  ];

  // 尝试提取描述部分
  // 方法1：找关键词后的内容
  const keywordIndex = content.indexOf(matchedKeyword);
  const afterKeyword = content.slice(keywordIndex + matchedKeyword.length).trim();

  // 移除常见连接词
  description = afterKeyword
    .replace(/^[，,：:。.\s]+/, '')  // 移除开头标点
    .replace(/^需求是/, '')
    .replace(/^需求：/, '')
    .replace(/^内容是/, '')
    .replace(/^内容：/, '')
    .replace(/^关于/, '')
    .replace(/^[，,：:。.\s]+/, '')  // 再次移除标点
    .trim();

  // 如果描述为空，尝试从关键词前提取
  if (!description) {
    const beforeKeyword = content.slice(0, keywordIndex).trim();
    if (beforeKeyword) {
      description = beforeKeyword
        .replace(/[，,：:。.\s]+$/, '')  // 移除结尾标点
        .trim();
    }
  }

  // 如果还是空，使用整个内容（移除关键词）
  if (!description) {
    description = content.replace(new RegExp(matchedKeyword, 'gi'), '').trim();
  }

  logStep("检测到 PRD 生成指令", { matchedKeyword, description: description.slice(0, 50) });

  return {
    isCommand: true,
    keyword: matchedKeyword,
    description: description || "一个新项目",  // 提供默认描述
  };
}

// ============================================
// 工具函数
// ============================================

/**
 * 解析 JSON 数组（容错处理）
 */
function parseJsonArray(rawText) {
  if (!rawText) {
    return [];
  }

  const text = rawText.trim();

  // 直接解析
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // 继续尝试修复
  }

  // 提取 JSON 数组部分
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const sliced = text.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(sliced);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // 尝试修复单引号
      try {
        const fixed = sliced.replace(/'/g, '"');
        const parsed = JSON.parse(fixed);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e2) {
        // 放弃
      }
    }
  }

  logStep("JSON 解析失败，返回空数组", { preview: text.slice(0, 100) });
  return [];
}

/**
 * 获取当前服务状态
 * 注意：返回的配置不包含真实 API Key
 */
function getStatus() {
  const provider = getProvider();
  let isReady = false;
  let statusError = null;
  try {
    isReady = provider === AI_PROVIDERS.MOCK || !!createClient(provider);
  } catch (err) {
    logStep("getStatus: createClient 失败", { error: err.message });
    statusError = err.message || String(err);
  }

  // 获取配置并脱敏
  const config = getRuntimeConfig();
  const safeConfig = {
    ...config,
    kimi: {
      ...config.kimi,
      // API Key 脱敏：仅返回是否已配置的标志
      apiKey: hasApiKey("kimi") ? "********" : "",
      hasApiKey: hasApiKey("kimi"),
    },
  };

  return {
    provider,
    model: getModelName(provider),
    isReady,
    statusError,
    config: safeConfig,
    availableModels: {
      ollama: AVAILABLE_OLLAMA_MODELS,
      kimi: AVAILABLE_KIMI_MODELS,
    },
  };
}

/**
 * 释放 Ollama 模型（卸载模型以释放内存）
 * @param {string} modelName - 可选，指定要释放的模型名称
 * @returns {Promise<Object>} 释放结果
 */
async function unloadModel(modelName) {
  const provider = getProvider();

  if (provider !== AI_PROVIDERS.OLLAMA) {
    return { success: false, message: `当前使用 ${provider} 模式，无需释放` };
  }

  const model = modelName || runtimeConfig.ollama.model;
  const baseURL = runtimeConfig.ollama.rawBaseURL;

  logStep("尝试释放 Ollama 模型", { model, baseURL });

  try {
    // 通过设置 keep_alive: 0 来立即卸载模型
    const response = await fetch(`${baseURL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        prompt: "",
        keep_alive: 0, // 立即卸载
      }),
    });

    if (response.ok) {
      logStep("模型释放成功", { model });
      return { success: true, message: `模型 ${model} 已释放`, model };
    } else {
      const errorText = await response.text();
      logStep("模型释放失败", { status: response.status, error: errorText });
      return { success: false, message: `释放失败: ${errorText}`, model };
    }
  } catch (error) {
    logStep("模型释放异常", { error: error.message });
    return { success: false, message: `释放异常: ${error.message}`, model };
  }
}

/**
 * 获取本地已安装的 Ollama 模型列表
 * @returns {Promise<Object>} 模型列表
 */
async function getOllamaModels() {
  const baseURL = runtimeConfig.ollama.rawBaseURL;

  try {
    const response = await fetch(`${baseURL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map(m => ({
        value: m.name,
        label: m.name,
        size: m.size,
        modified: m.modified_at,
      }));
      return { success: true, models };
    } else {
      return { success: false, models: [], error: "无法连接 Ollama 服务" };
    }
  } catch (error) {
    return { success: false, models: [], error: error.message };
  }
}

// ============================================
// PDF 脏数据清洗（断行修复、去噪）
// ============================================

/**
 * PDF 内容智能重排：修复断行、去除页眉页脚页码、输出结构化 Markdown
 * @param {string} rawText - 从 PDF 识别出的混乱文本
 * @returns {Promise<string>} 结构清晰的 Markdown
 */
async function structureDocument(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("没有可清洗的文档内容");
  }
  const text = rawText.length > REFORMAT_MAX_CHARS
    ? rawText.slice(0, REFORMAT_MAX_CHARS) + "\n\n[后文过长已省略，仅处理前 " + REFORMAT_MAX_CHARS + " 字]"
    : rawText;
  logStep("开始 PDF 智能重排与清洗", { inputLength: rawText.length, sentLength: text.length });

  const systemPrompt = `你是一个专业的 PDF 文档还原专家。
你的任务是：接收从 PDF 识别出的混乱文本，输出结构清晰的 Markdown。

关键处理：
1. 修复断行：PDF 经常把一句话强行切成两行，请务必根据语义将它们合并成完整句子。
2. 去除噪音：删除页眉、页脚、页码（如 "Page 1 of 10"）、水印文字等与正文无关的内容。
3. 保留原意：严禁修改原文的任何数据、数值或核心表述，只做格式与噪音清理。`;

  const userPrompt = `请对以下从 PDF 识别出的文本进行重排与清洗，输出结构清晰的 Markdown：\n\n${text}`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const content = await callAI(messages, { temperature: 0.4, max_tokens: 8192 });
  logStep("PDF 智能重排与清洗完成", { outputLength: content.length });
  return content;
}

// ============================================
// 原型生成服务 (New)
// ============================================

/**
 * 流式生成 HTML 原型（异步生成器，逐 chunk 产出）
 * @param {string} prdText - PRD 文档内容
 * @yields {string} 每个 delta 文本片段
 */
async function* generatePrototypeStream(prdText) {
  logStep("开始流式生成 HTML 原型", { prdLength: prdText.length });

  const systemPrompt = `你是一位世界顶级的前端工程师和 UX 设计师，擅长将需求文档快速转化为高保真的 HTML 原型。
你的目标是：根据用户提供的 PRD 文档，编写一个**单文件 HTML** 原型。

**核心要求：**
1. **单文件交付**：HTML、CSS、JS 全部内联在一个 index.html 文件中。
2. **技术栈**：
   - 使用 Tailwind CSS (通过 CDN 引入) 进行快速样式开发。
   - **严禁使用 FontAwesome**（风格过时）。
   - **推荐使用 Lucide Icons** (通过 <script src="https://unpkg.com/lucide@latest"></script> 引入，并在 HTML 中使用 <i data-lucide="icon-name"></i>，最后调用 lucide.createIcons())，或者直接使用高质量的 SVG 代码。
   - 使用 Google Fonts (Inter 或 Roboto) 提升字体质感。
   - 使用包含 vanilla JavaScript 的 <script> 标签实现交互逻辑。
3. **视觉风格**：
   - **现代高端**：使用柔和的阴影、圆角、磨砂玻璃效果 (Glassmorphism)、微交互动画。
   - **配色方案**：根据 PRD 语境自动选择适合的配色（如企业SaaS用蓝色系，C端应用用活力色），支持深色模式 (Dark Mode) 更好。
   - **布局**：完全响应式，适配移动端和桌面端。
4. **交互逻辑**：
   - 按钮要有 Hover 效果和点击反馈。
   - 导航栏、Tab 切换、模态框 (Modal) 等基础组件必须是可交互的（使用 JS 实现）。
   - 如果 PRD 提到图表，使用 Canvas 或简单的 CSS 模拟，或者引入 Chart.js (CDN)。

**输出格式：**
只输出 HTML 代码，不要包含 Markdown 代码块标记（如 \`\`\`html），直接输出 <!DOCTYPE html> 开头的内容。
`;

  const userPrompt = `请根据以下 PRD 文档内容，设计并生成一个高保真的 HTML/CSS/JS 原型：

---
${prdText}
---

请开始编写 HTML 代码：`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // 使用较长的 max_tokens 以确保 HTML 完整生成
  yield* callAIStream(messages, { temperature: 0.7, max_tokens: 16000 });
  logStep("流式 HTML 原型生成完成");
}

// ============================================
// 导出
// ============================================

module.exports = {
  // 核心函数
  callAI,
  reviewDocument,
  reviewDocumentStream, // 流式审查文档（Chain-of-Thought + SSE）
  replyToComment,
  chat,
  generatePRD,         // 生成 PRD 文档
  generatePRDStream,   // 流式生成 PRD 文档
  detectPRDCommand,    // 检测 PRD 生成指令
  reformatDocument,       // 用 AI 对文档重新排版（一次性）
  reformatDocumentStream, // 流式重新排版（供 SSE）
  structureDocument,   // PDF 脏数据清洗（断行修复、去噪、结构化 Markdown）
  generatePrototypeStream, // 流式生成 HTML 原型 (New)

  // 配置管理
  getProvider,
  getStatus,
  getRuntimeConfig,
  setRuntimeConfig,
  initRuntimeConfig,  // 新增：服务启动时初始化配置

  // 安全 API Key 管理
  getSecureApiKey,    // 安全获取 API Key（环境变量优先）
  hasApiKey,          // 检查 API Key 是否已配置

  // 模型管理
  unloadModel,
  getOllamaModels,

  // 工具函数
  parseJsonArray,

  // 常量
  AI_PROVIDERS,
  MOCK_RESPONSES,
  AVAILABLE_OLLAMA_MODELS,
  AVAILABLE_KIMI_MODELS,
};
