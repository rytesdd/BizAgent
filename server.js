const express = require("express");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");

// 加载环境变量
dotenv.config();

// 导入 AI 服务层
const aiService = require("./services/aiService");
// 导入文件解析服务
const fileParser = require("./services/fileParser");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// ============================================
// 评论来源类型常量
// ============================================
const AUTHOR_TYPES = {
  // 甲方
  AI_CLIENT: "AI_CLIENT",           // 甲方 AI 自动生成
  HUMAN_CLIENT: "HUMAN_CLIENT",     // 甲方真人

  // 乙方
  AI_VENDOR: "AI_VENDOR",           // 乙方 AI 自动生成
  HUMAN_VENDOR: "HUMAN_VENDOR",     // 乙方真人

  // 系统
  SYSTEM: "SYSTEM",                 // 系统消息
};

// ============================================
// 乙方回复规则配置
// ============================================
const VENDOR_REPLY_RULES = {
  // 是否允许乙方 AI 回复甲方 AI 的评论
  // 当前设置为 false，后续可通过配置开放
  allowReplyToAiClient: false,

  // 允许回复的甲方评论类型
  allowedClientTypes: [AUTHOR_TYPES.HUMAN_CLIENT],
};

// 默认 AI 配置（2026 Agentic AI 结构 + 审查/回复策略）
const DEFAULT_CLIENT_AI_CONFIG = {
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
    output_format: "markdown_report",
  },
  reviewer_mode: {
    focus: ["逻辑漏洞", "合规风险", "歧义表达"],
    strictness: 0.6,
  },
  replier_mode: {
    stance: "discuss",
    grounding_doc: true,
    grounding_sop: false,
  },
};

const DEFAULT_VENDOR_AI_CONFIG = {
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
    output_format: "markdown_report",
  },
  reviewer_mode: {
    focus: ["逻辑漏洞", "合规风险"],
    strictness: 0.4,
  },
  replier_mode: {
    stance: "discuss",
    grounding_doc: true,
    grounding_sop: false,
  },
};

const DEFAULT_DB = {
  project_context: { prd_text: "", prd_file_path: "" },
  personas: {
    client: "挑剔技术总监",
    vendor: "卑微项目经理",
  },
  client_ai_config: DEFAULT_CLIENT_AI_CONFIG,
  vendor_ai_config: DEFAULT_VENDOR_AI_CONFIG,
  // 模型配置（持久化）
  model_config: {
    provider: "mock",
    ollama: { model: "qwen3-vl:8b" },
    kimi: { model: "moonshot-v1-8k", apiKey: "" },
  },
  comments: [],
  // 会话管理（新结构）
  client_chat_sessions: [],  // 甲方会话列表
  vendor_chat_sessions: [],  // 乙方会话列表
  current_client_session_id: null,  // 当前甲方会话 ID
  current_vendor_session_id: null,  // 当前乙方会话 ID
  // 兼容旧结构（迁移用）
  client_chat_messages: [],
  vendor_chat_messages: [],
};

const upload = multer({ dest: UPLOAD_DIR });

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// 日志工具
// ============================================

function logStep(message, meta) {
  const timestamp = new Date().toISOString();
  if (meta) {
    console.log(`[${timestamp}] ${message}`, meta);
    return;
  }
  console.log(`[${timestamp}] ${message}`);
}

// ============================================
// 数据库操作（内存缓存 + 防抖异步落盘，避免阻塞 I/O）
// ============================================

/** 内存中的 db 副本，GET 请求直接读缓存，减少磁盘 I/O */
let dbCache = null;

/** 防抖：距上次 writeDb 1 秒后再写盘，避免频繁同步写阻塞主线程 */
const DEBOUNCE_WRITE_MS = 1000;
let writeTimeoutId = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logStep("创建目录", { dirPath });
  }
}

function ensureDbFile() {
  ensureDir(DATA_DIR);
  ensureDir(UPLOAD_DIR);

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
    logStep("初始化 db.json", { DB_PATH });
    return;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("db.json 不是对象");
    }
    // 确保新字段存在（迁移旧数据）
    let needsUpdate = false;
    if (!parsed.client_chat_messages) {
      parsed.client_chat_messages = parsed.chat_messages || [];
      needsUpdate = true;
    }
    if (!parsed.vendor_chat_messages) {
      parsed.vendor_chat_messages = [];
      needsUpdate = true;
    }
    // 删除旧字段
    if (parsed.chat_messages) {
      delete parsed.chat_messages;
      needsUpdate = true;
    }
    // 会话管理字段（避免旧 db 缺键导致路由 500）
    if (!Array.isArray(parsed.client_chat_sessions)) {
      parsed.client_chat_sessions = [];
      needsUpdate = true;
    }
    if (!Array.isArray(parsed.vendor_chat_sessions)) {
      parsed.vendor_chat_sessions = [];
      needsUpdate = true;
    }
    if (parsed.current_client_session_id === undefined) {
      parsed.current_client_session_id = null;
      needsUpdate = true;
    }
    if (parsed.current_vendor_session_id === undefined) {
      parsed.current_vendor_session_id = null;
      needsUpdate = true;
    }
    if (needsUpdate) {
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), "utf8");
    }
  } catch (error) {
    const backupPath = `${DB_PATH}.broken.${Date.now()}.json`;
    fs.copyFileSync(DB_PATH, backupPath);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
    logStep("修复损坏 db.json", { backupPath, error: String(error) });
  }
}

/** 实际写盘（异步），仅由 debouncedFlushDb 调用 */
function flushDbToDisk() {
  if (dbCache === null) return;
  const toWrite = JSON.stringify(dbCache, null, 2);
  const tempPath = `${DB_PATH}.tmp`;
  fsp
    .writeFile(tempPath, toWrite, "utf8")
    .then(() => fsp.rename(tempPath, DB_PATH))
    .then(() => logStep("db.json 已异步落盘"))
    .catch((err) => {
      fsp.writeFile(DB_PATH, toWrite, "utf8").catch(() => { });
      if (tempPath) fsp.unlink(tempPath).catch(() => { });
      logStep("db.json 异步落盘失败，已回退写主文件", { error: String(err) });
    });
}

/** 防抖：1 秒内多次 writeDb 只触发一次落盘 */
function debouncedFlushDb() {
  if (writeTimeoutId) clearTimeout(writeTimeoutId);
  writeTimeoutId = setTimeout(() => {
    writeTimeoutId = null;
    flushDbToDisk();
  }, DEBOUNCE_WRITE_MS);
}

function readDb() {
  ensureDbFile();
  if (dbCache !== null) {
    return JSON.parse(JSON.stringify(dbCache));
  }
  const raw = fs.readFileSync(DB_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    dbCache = parsed;
    return JSON.parse(JSON.stringify(parsed));
  } catch (e) {
    logStep("readDb 解析失败，触发修复", { error: String(e) });
    ensureDbFile();
    const retry = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(retry);
    dbCache = parsed;
    return JSON.parse(JSON.stringify(parsed));
  }
}

function writeDb(db) {
  ensureDbFile();
  dbCache = db;
  debouncedFlushDb();
}

// ============================================
// 工具函数
// ============================================

function generateId(prefix = "msg") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ============================================
// 会话管理辅助函数
// ============================================

/**
 * 创建新会话
 */
function createSession(viewRole, title = "") {
  const now = new Date().toISOString();
  return {
    id: generateId("session"),
    title: title || `新对话 ${new Date().toLocaleString("zh-CN")}`,
    view_role: viewRole,
    created_at: now,
    updated_at: now,
    messages: [],
  };
}

/**
 * 获取会话配置 key
 */
function getSessionKeys(viewRole) {
  const isVendor = viewRole === "vendor";
  return {
    sessionsKey: isVendor ? "vendor_chat_sessions" : "client_chat_sessions",
    currentIdKey: isVendor ? "current_vendor_session_id" : "current_client_session_id",
    legacyKey: isVendor ? "vendor_chat_messages" : "client_chat_messages",
    roleName: isVendor ? "乙方" : "甲方",
  };
}

/**
 * 获取或创建当前会话
 * 包含旧数据迁移逻辑
 * 返回: { session: Object, modified: boolean }
 */
function getOrCreateCurrentSession(db, viewRole) {
  const { sessionsKey, currentIdKey, legacyKey, roleName } = getSessionKeys(viewRole);
  let modified = false;

  // 确保会话数组存在
  if (!db[sessionsKey]) {
    db[sessionsKey] = [];
    // 初始化数组不算作修改数据的理由（除非真有数据要存，否则空数组不需要急着落盘）
  }

  // 迁移旧数据（如果存在）
  const legacyMessages = db[legacyKey] || [];
  if (legacyMessages.length > 0 && db[sessionsKey].length === 0) {
    const migratedSession = createSession(viewRole, `历史对话（已迁移）`);
    migratedSession.messages = legacyMessages;
    migratedSession.updated_at = legacyMessages[legacyMessages.length - 1]?.created_at || migratedSession.created_at;
    db[sessionsKey].push(migratedSession);
    db[currentIdKey] = migratedSession.id;
    db[legacyKey] = []; // 清空旧数据
    logStep(`迁移 ${roleName} 旧聊天记录到会话`, { messageCount: legacyMessages.length, sessionId: migratedSession.id });
    modified = true;
  }

  // 获取当前会话
  let currentSession = null;
  if (db[currentIdKey]) {
    currentSession = db[sessionsKey].find(s => s.id === db[currentIdKey]);
  }

  // 如果没有当前会话，创建一个新的
  if (!currentSession) {
    currentSession = createSession(viewRole);
    db[sessionsKey].push(currentSession);
    db[currentIdKey] = currentSession.id;
    logStep(`创建新 ${roleName} 会话`, { sessionId: currentSession.id });
    modified = true;
  }

  return { session: currentSession, modified };
}

/**
 * 自动更新会话标题（基于第一条用户消息）
 */
function autoUpdateSessionTitle(session) {
  if (session.title.startsWith("新对话") && session.messages.length > 0) {
    const firstUserMsg = session.messages.find(m => m.role === "user");
    if (firstUserMsg) {
      // 取前 20 个字符作为标题
      const content = firstUserMsg.content.trim();
      session.title = content.length > 20 ? content.slice(0, 20) + "..." : content;
    }
  }
}

function normalizeCommentItem(item, index) {
  return {
    id: generateId("comment"),
    author_type: AUTHOR_TYPES.AI_CLIENT, // 甲方 AI 评论
    content: String(item?.content || "").trim(),
    target_user_id: String(item?.at_user || "").trim(),
    quoted_text: String(item?.quoted_text || "").trim(), // 被评论的 PRD 原文片段，用于前端黄色下划线与点击定位
    target_id: item?.target_id || null,  // Native ID Generation: preserve AI-assigned target ID
    reply_content: "",
    reply_author_type: null,
    created_at: new Date().toISOString(),
  };
}

/**
 * 检查是否允许乙方 AI 回复该评论
 */
function canVendorAiReply(comment) {
  const authorType = comment.author_type;

  // 如果是甲方 AI 评论
  if (authorType === AUTHOR_TYPES.AI_CLIENT) {
    return VENDOR_REPLY_RULES.allowReplyToAiClient;
  }

  // 检查是否在允许列表中
  return VENDOR_REPLY_RULES.allowedClientTypes.includes(authorType);
}

// ============================================
// API: 获取 AI 服务状态
// ============================================

app.get("/api/ai/status", (req, res) => {
  try {
    const status = aiService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logStep("获取 AI 状态失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 释放本地模型（卸载 Ollama 模型以释放内存）
// ============================================

app.post("/api/ai/unload", async (req, res) => {
  try {
    const { model } = req.body || {};
    logStep("收到模型释放请求", { model });
    const result = await aiService.unloadModel(model);

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    logStep("模型释放失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 获取/更新模型配置（支持运行时切换）
// ============================================

app.get("/api/ai/config", (req, res) => {
  try {
    const config = aiService.getRuntimeConfig();
    const status = aiService.getStatus();
    // 返回给前端时脱敏：Kimi API Key 不传明文，仅表示是否已配置
    const data = {
      ...config,
      availableModels: status.availableModels,
    };
    if (data.kimi?.apiKey) {
      data.kimi = { ...data.kimi, apiKey: "********" };
    }
    res.json({ success: true, data });
  } catch (error) {
    logStep("获取模型配置失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.post("/api/ai/config", (req, res) => {
  try {
    const { provider, ollama, kimi } = req.body || {};
    logStep("收到模型配置更新请求", { provider, ollama, kimi });

    // 1. 更新运行时配置
    const newConfig = aiService.setRuntimeConfig({ provider, ollama, kimi });

    // 2. 持久化到 db.json（Kimi API Key 不写入，仅通过 .env 配置）
    const db = readDb();
    db.model_config = {
      provider: newConfig.provider,
      ollama: newConfig.ollama,
      kimi: {
        model: newConfig.kimi?.model,
        apiKey: "", // 不持久化密钥，使用 .env 中的 KIMI_API_KEY
      },
    };
    writeDb(db);
    logStep("模型配置已持久化到 db.json");

    const status = aiService.getStatus();

    res.json({
      success: true,
      data: {
        ...newConfig,
        currentModel: status.model,
        isReady: status.isReady,
      },
    });
  } catch (error) {
    logStep("更新模型配置失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 获取本地已安装的 Ollama 模型列表
// ============================================

app.get("/api/ai/ollama-models", async (req, res) => {
  try {
    const result = await aiService.getOllamaModels();
    res.json({ success: result.success, data: result });
  } catch (error) {
    logStep("获取 Ollama 模型列表失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 通用 AI 聊天接口（供前端直接调用 AI）
// ============================================

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "messages 参数无效：需要一个非空的消息数组"
      });
    }

    logStep("[AI Chat] 收到聊天请求", { messageCount: messages.length });

    // 调用 aiService.callAI (底层会根据当前配置选择 mock/ollama/kimi)
    const content = await aiService.callAI(messages, {
      temperature: 0.3,
      max_tokens: 4096,
    });

    logStep("[AI Chat] AI 回复成功", { contentLength: content?.length });

    res.json({
      success: true,
      data: { content }
    });
  } catch (error) {
    logStep("[AI Chat] 调用失败", { error: String(error) });
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
});

// ============================================
// API: 文件解析状态
// ============================================

app.get("/api/file/status", (req, res) => {
  try {
    const status = fileParser.getParserStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logStep("获取文件解析状态失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 上传并解析文件
// ============================================

app.post("/api/file/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "请上传文件" });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    logStep("收到文件上传", { originalName, size: req.file.size });

    // 解析文件（传入原始文件名以便正确识别 PDF/TXT/MD，multer 保存路径无扩展名）
    const result = await fileParser.parseFile(filePath, originalName);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    if (result.type === "PDF") {
      result.content = await aiService.structureDocument(result.content);
      logStep("已完成 PDF 智能重排与清洗");
    }

    // 保存到数据库（新 PRD 替换旧文档，评论仅跟随当前 PRD，故清空旧评论）
    const db = readDb();
    db.project_context = {
      prd_text: result.content,
      prd_file_path: path.relative(__dirname, filePath),
      file_name: originalName,
      file_type: result.type,
      uploaded_at: new Date().toISOString(),
    };
    db.comments = [];
    writeDb(db);

    logStep("文件解析并保存成功", { type: result.type, length: result.content.length });

    res.json({
      success: true,
      data: {
        content: result.content,
        type: result.type,
        metadata: result.metadata,
        file_name: originalName,
        file_path: path.relative(__dirname, filePath),
      },
    });
  } catch (error) {
    logStep("文件上传解析失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 提供已上传文件（供 PRD 预览区展示 PDF）
// ============================================

app.get("/api/file/serve", (req, res) => {
  try {
    const relativePath = req.query.path;
    if (!relativePath || typeof relativePath !== "string") {
      return res.status(400).json({ success: false, error: "缺少 path 参数" });
    }
    const resolved = path.resolve(__dirname, relativePath);
    const uploadDirResolved = path.resolve(UPLOAD_DIR);
    if (!resolved.startsWith(uploadDirResolved)) {
      return res.status(403).json({ success: false, error: "无权访问该文件" });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, error: "文件不存在" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(resolved);
  } catch (error) {
    logStep("文件服务失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 用本地模型对当前 PRD 文档重新排版（流式 SSE）
// ============================================

app.post("/api/prd/reformat", async (req, res) => {
  try {
    const db = readDb();
    const rawText = db.project_context?.prd_text || "";
    if (!rawText.trim()) {
      return res.status(400).json({ success: false, error: "当前没有可整理的文档内容" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let fullContent = "";
    try {
      for await (const chunk of aiService.reformatDocumentStream(rawText)) {
        fullContent += chunk;
        res.write("data: " + JSON.stringify({ type: "delta", content: chunk }) + "\n\n");
      }
      const dbWrite = readDb();
      dbWrite.project_context = { ...dbWrite.project_context, prd_text: fullContent };
      writeDb(dbWrite);
      logStep("PRD 重新整理已保存（流式）", { length: fullContent.length });
      res.write("data: " + JSON.stringify({ type: "done", content: fullContent }) + "\n\n");
    } catch (streamErr) {
      logStep("PRD 流式重新整理失败", { error: String(streamErr) });
      res.write("data: " + JSON.stringify({ type: "error", error: streamErr.message || String(streamErr) }) + "\n\n");
    }
    res.end();
  } catch (error) {
    logStep("PRD 重新整理失败", { error: String(error) });
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// ============================================
// API: 甲方审查文档
// ============================================

app.post("/api/client/review", upload.single("prd_file"), async (req, res) => {
  try {
    const db = readDb();
    let prdText = "";
    let prdFilePath = "";
    let fileName = "";

    if (req.file) {
      prdFilePath = path.relative(__dirname, req.file.path);
      fileName = req.file.originalname;

      // 使用文件解析服务（支持 PDF、TXT、MD）；传入原始文件名以便识别类型（multer 路径无扩展名）
      const parseResult = await fileParser.parseFile(req.file.path, req.file.originalname);
      if (!parseResult.success) {
        return res.status(400).json({ success: false, error: parseResult.error });
      }
      prdText = parseResult.content;
      logStep("解析上传 PRD 文件", { prdFilePath, type: parseResult.type, length: prdText.length });
    } else if (req.body?.prd_text) {
      prdText = String(req.body.prd_text);
      prdFilePath = "";
      logStep("使用请求中的 PRD 文本");
    } else {
      prdText = db.project_context?.prd_text || "";
      prdFilePath = db.project_context?.prd_file_path || "";
      logStep("使用历史 PRD 上下文");
    }

    if (!prdText.trim()) {
      return res.status(400).json({ success: false, error: "PRD 内容为空" });
    }

    db.project_context = {
      prd_text: prdText,
      prd_file_path: prdFilePath,
      file_name: fileName,
      updated_at: new Date().toISOString(),
    };
    // 评论仅跟随当前 PRD：每次审查前清空旧评论，只保留本次审查结果
    db.comments = [];

    const persona = db.personas?.client || DEFAULT_DB.personas.client;
    const aiConfig = db.client_ai_config || DEFAULT_CLIENT_AI_CONFIG;

    // 使用新的 AI 服务层
    const auditItems = await aiService.reviewDocument(prdText, persona, aiConfig);
    const comments = auditItems.map(normalizeCommentItem);

    // 记录日志
    comments.forEach((item) => {
      logStep("[甲方AI评论]", {
        id: item.id,
        at_user: item.target_user_id,
        content_preview: item.content.slice(0, 50),
      });
    });

    db.comments.push(...comments);
    writeDb(db);

    res.json({ success: true, data: { comments } });
  } catch (error) {
    logStep("Client Review 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 处理评论（支持真人和 AI 回复）
// ============================================

app.post("/api/vendor/handle-comment", async (req, res) => {
  try {
    const { comment_content: commentContent, author, trigger_ai_reply: triggerAiReply } = req.body || {};
    if (!commentContent) {
      return res.status(400).json({ success: false, error: "comment_content 不能为空" });
    }

    const db = readDb();
    const normalizedAuthor = author || AUTHOR_TYPES.HUMAN_CLIENT;

    // 创建新评论
    const comment = {
      id: generateId("comment"),
      author_type: normalizedAuthor,
      content: String(commentContent),
      target_user_id: "",
      reply_content: "",
      reply_author_type: null,
      created_at: new Date().toISOString(),
    };

    db.comments.push(comment);
    writeDb(db);
    logStep("写入评论", { author: normalizedAuthor, id: comment.id });

    // 判断是否需要触发乙方 AI 回复
    const shouldTriggerAiReply = triggerAiReply !== false && canVendorAiReply(comment);

    if (shouldTriggerAiReply) {
      const persona = db.personas?.vendor || DEFAULT_DB.personas.vendor;
      const prdText = db.project_context?.prd_text || "";
      const aiConfig = db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

      // 使用新的 AI 服务层
      const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

      const updatedDb = readDb();
      const target = updatedDb.comments.find((item) => item.id === comment.id);
      if (target) {
        target.reply_content = replyText.trim();
        target.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
        writeDb(updatedDb);
        logStep("写入乙方 AI 回复", { id: comment.id });
      }

      // 返回包含回复的完整评论
      return res.json({
        success: true,
        data: {
          ...comment,
          reply_content: replyText.trim(),
          reply_author_type: AUTHOR_TYPES.AI_VENDOR,
        }
      });
    }

    res.json({ success: true, data: comment });
  } catch (error) {
    logStep("Vendor Handle Comment 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 乙方真人回复指定评论
// ============================================

app.post("/api/vendor/human-reply", async (req, res) => {
  try {
    const { comment_id: commentId, reply_content: replyContent } = req.body || {};

    if (!commentId) {
      return res.status(400).json({ success: false, error: "comment_id 不能为空" });
    }
    if (!replyContent || !replyContent.trim()) {
      return res.status(400).json({ success: false, error: "reply_content 不能为空" });
    }

    const db = readDb();
    const comment = db.comments.find((c) => c.id === commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    // 检查是否已有回复
    if (comment.reply_content) {
      return res.status(400).json({ success: false, error: "该评论已有回复" });
    }

    // 写入真人回复
    comment.reply_content = replyContent.trim();
    comment.reply_author_type = AUTHOR_TYPES.HUMAN_VENDOR;
    comment.reply_created_at = new Date().toISOString();
    writeDb(db);

    logStep("乙方真人回复", { commentId, replyLength: replyContent.length });

    res.json({ success: true, data: comment });
  } catch (error) {
    logStep("乙方真人回复失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 手动触发乙方 AI 回复指定评论
// ============================================

app.post("/api/vendor/reply", async (req, res) => {
  try {
    const { comment_id: commentId, force } = req.body || {};
    if (!commentId) {
      return res.status(400).json({ success: false, error: "comment_id 不能为空" });
    }

    const db = readDb();
    const comment = db.comments.find((c) => c.id === commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    // 检查是否已有回复
    if (comment.reply_content && !force) {
      return res.status(400).json({ success: false, error: "该评论已有回复，使用 force=true 强制覆盖" });
    }

    // 检查回复规则（force 可以绕过规则）
    if (!force && !canVendorAiReply(comment)) {
      return res.status(403).json({
        success: false,
        error: `当前规则不允许回复 ${comment.author_type} 类型的评论`,
        hint: "可以设置 force=true 强制回复，或等待后续开放此能力",
      });
    }

    const persona = db.personas?.vendor || DEFAULT_DB.personas.vendor;
    const prdText = db.project_context?.prd_text || "";
    const aiConfig = db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

    const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

    comment.reply_content = replyText.trim();
    comment.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
    writeDb(db);

    logStep("手动触发乙方 AI 回复", { commentId, forcedAiReply: !!force });

    res.json({ success: true, data: comment });
  } catch (error) {
    logStep("Vendor Reply 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 自动触发乙方 AI 回复（仅限甲方真人评论）
// ============================================

app.post("/api/vendor/auto-reply", async (req, res) => {
  try {
    const { comment_id: commentId } = req.body || {};
    if (!commentId) {
      return res.status(400).json({ success: false, error: "comment_id 不能为空" });
    }

    const db = readDb();
    const comment = db.comments.find((c) => c.id === commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    // 检查是否已有回复
    if (comment.reply_content) {
      return res.status(400).json({ success: false, error: "该评论已有回复" });
    }

    // 关键：仅允许回复甲方真人评论，防止 AI 互怼无限循环
    if (comment.author_type !== AUTHOR_TYPES.HUMAN_CLIENT) {
      logStep("自动回复跳过", { commentId, author_type: comment.author_type, reason: "非甲方真人评论" });
      return res.status(400).json({
        success: false,
        error: "自动回复仅针对甲方真人评论",
        skipped: true,
      });
    }

    const persona = db.personas?.vendor || DEFAULT_DB.personas.vendor;
    const prdText = db.project_context?.prd_text || "";
    const aiConfig = db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

    logStep("触发自动回复", { commentId, author_type: comment.author_type });

    const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

    // 重新读取数据库以获取最新状态
    const updatedDb = readDb();
    const updatedComment = updatedDb.comments.find((c) => c.id === commentId);
    if (updatedComment) {
      updatedComment.reply_content = replyText.trim();
      updatedComment.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
      updatedComment.reply_created_at = new Date().toISOString();
      writeDb(updatedDb);
      logStep("自动回复完成", { commentId, replyLength: replyText.length });
    }

    res.json({ success: true, data: updatedComment || comment });
  } catch (error) {
    logStep("自动回复失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 自动触发乙方 AI 回复（SSE 流式 + 思维链）
// ============================================

app.post("/api/vendor/auto-reply-stream", async (req, res) => {
  // SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const sendEvent = (data) => {
    res.write("data: " + JSON.stringify(data) + "\n\n");
  };

  try {
    const { comment_id: commentId } = req.body || {};
    if (!commentId) {
      sendEvent({ type: "error", error: "comment_id 不能为空" });
      return res.end();
    }

    const db = readDb();
    const comment = db.comments.find((c) => c.id === commentId);

    if (!comment) {
      sendEvent({ type: "error", error: "评论不存在" });
      return res.end();
    }

    if (comment.reply_content) {
      sendEvent({ type: "error", error: "该评论已有回复" });
      return res.end();
    }

    if (comment.author_type !== AUTHOR_TYPES.HUMAN_CLIENT) {
      sendEvent({ type: "error", error: "自动回复仅针对甲方真人评论", skipped: true });
      return res.end();
    }

    const prdText = db.project_context?.prd_text || "";
    const persona = db.personas?.vendor || DEFAULT_DB.personas.vendor;
    const aiConfig = db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;

    // 思维链步骤 1: 分析评论
    sendEvent({
      type: "thinking",
      step: "analyze",
      title: "分析评论内容",
      content: comment.content,
    });

    // 稍作延迟以显示步骤
    await new Promise((r) => setTimeout(r, 300));

    // 思维链步骤 2: 读取 PRD 上下文
    const prdSnippet = prdText.slice(0, 200) + (prdText.length > 200 ? "..." : "");
    sendEvent({
      type: "thinking",
      step: "context",
      title: "读取 PRD 上下文",
      content: prdSnippet || "(无 PRD 内容)",
    });

    await new Promise((r) => setTimeout(r, 300));

    // 思维链步骤 3: 开始生成
    sendEvent({ type: "generating" });

    logStep("触发自动回复（SSE）", { commentId, author_type: comment.author_type });

    const replyText = await aiService.replyToComment(comment.content, prdText, persona, aiConfig);

    // 写入数据库
    const updatedDb = readDb();
    const updatedComment = updatedDb.comments.find((c) => c.id === commentId);
    if (updatedComment) {
      updatedComment.reply_content = replyText.trim();
      updatedComment.reply_author_type = AUTHOR_TYPES.AI_VENDOR;
      updatedComment.reply_created_at = new Date().toISOString();
      writeDb(updatedDb);
      logStep("自动回复完成（SSE）", { commentId, replyLength: replyText.length });
    }

    // 思维链步骤 4: 完成
    sendEvent({
      type: "done",
      reply: replyText.trim(),
    });
  } catch (error) {
    logStep("自动回复失败（SSE）", { error: String(error) });
    sendEvent({ type: "error", error: error.message || String(error) });
  }

  res.end();
});

// ============================================
// API: 会话管理 - 获取会话列表
// ============================================

app.get("/api/chat/sessions", (req, res) => {
  try {
    const db = readDb();
    const viewRole = req.query.view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(viewRole);

    // 确保当前会话存在（触发迁移逻辑）
    const { modified } = getOrCreateCurrentSession(db, viewRole);
    if (modified) {
      writeDb(db);
    }

    const sessions = db[sessionsKey] || [];
    const currentSessionId = db[currentIdKey];

    // 返回会话列表（不包含消息内容，减少传输量）
    const sessionList = sessions.map(s => ({
      id: s.id,
      title: s.title,
      created_at: s.created_at,
      updated_at: s.updated_at,
      message_count: s.messages?.length || 0,
      is_current: s.id === currentSessionId,
    })).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    res.json({
      success: true,
      data: {
        sessions: sessionList,
        current_session_id: currentSessionId,
        view_role: viewRole,
      },
    });
  } catch (error) {
    logStep("获取会话列表失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 会话管理 - 创建新会话
// ============================================

app.post("/api/chat/sessions", (req, res) => {
  try {
    const { view_role, title } = req.body || {};
    const viewRole = view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(viewRole);

    const db = readDb();

    // 创建新会话
    const newSession = createSession(viewRole, title);

    if (!db[sessionsKey]) db[sessionsKey] = [];
    db[sessionsKey].push(newSession);
    db[currentIdKey] = newSession.id;
    writeDb(db);

    logStep(`创建 ${roleName} 新会话`, { sessionId: newSession.id, title: newSession.title });

    res.json({
      success: true,
      data: {
        session: {
          id: newSession.id,
          title: newSession.title,
          created_at: newSession.created_at,
          updated_at: newSession.updated_at,
          message_count: 0,
          is_current: true,
        },
        current_session_id: newSession.id,
      },
    });
  } catch (error) {
    logStep("创建会话失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 会话管理 - 切换会话
// ============================================

app.post("/api/chat/sessions/switch", (req, res) => {
  try {
    const { view_role, session_id } = req.body || {};
    if (!session_id) {
      return res.status(400).json({ success: false, error: "session_id 不能为空" });
    }

    const viewRole = view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(viewRole);

    const db = readDb();
    const sessions = db[sessionsKey] || [];
    const targetSession = sessions.find(s => s.id === session_id);

    if (!targetSession) {
      return res.status(404).json({ success: false, error: "会话不存在" });
    }

    db[currentIdKey] = session_id;
    writeDb(db);

    logStep(`切换 ${roleName} 会话`, { sessionId: session_id, title: targetSession.title });

    res.json({
      success: true,
      data: {
        current_session_id: session_id,
        session: {
          id: targetSession.id,
          title: targetSession.title,
          created_at: targetSession.created_at,
          updated_at: targetSession.updated_at,
          message_count: targetSession.messages?.length || 0,
        },
      },
    });
  } catch (error) {
    logStep("切换会话失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 会话管理 - 删除会话
// ============================================

app.delete("/api/chat/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const viewRole = req.query.view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(viewRole);

    const db = readDb();
    const sessions = db[sessionsKey] || [];
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);

    if (sessionIndex === -1) {
      return res.status(404).json({ success: false, error: "会话不存在" });
    }

    const deletedSession = sessions[sessionIndex];
    sessions.splice(sessionIndex, 1);
    db[sessionsKey] = sessions;

    // 如果删除的是当前会话，切换到最新的会话或创建新会话
    if (db[currentIdKey] === sessionId) {
      if (sessions.length > 0) {
        // 切换到最新的会话
        const latestSession = sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
        db[currentIdKey] = latestSession.id;
      } else {
        // 创建新会话
        const newSession = createSession(viewRole);
        db[sessionsKey].push(newSession);
        db[currentIdKey] = newSession.id;
      }
    }

    writeDb(db);

    logStep(`删除 ${roleName} 会话`, { sessionId, title: deletedSession.title });

    res.json({
      success: true,
      data: {
        deleted_session_id: sessionId,
        current_session_id: db[currentIdKey],
      },
    });
  } catch (error) {
    logStep("删除会话失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 会话管理 - 重命名会话
// ============================================

app.patch("/api/chat/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { view_role, title } = req.body || {};
    const viewRole = view_role || "client";
    const { sessionsKey, roleName } = getSessionKeys(viewRole);

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "title 不能为空" });
    }

    const db = readDb();
    const sessions = db[sessionsKey] || [];
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      return res.status(404).json({ success: false, error: "会话不存在" });
    }

    session.title = title.trim();
    session.updated_at = new Date().toISOString();
    writeDb(db);

    logStep(`重命名 ${roleName} 会话`, { sessionId, newTitle: session.title });

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          updated_at: session.updated_at,
        },
      },
    });
  } catch (error) {
    logStep("重命名会话失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: Chat 消息 - 发送消息（支持会话）
// ============================================

app.post("/api/chat/send", async (req, res) => {
  try {
    const { content, view_role } = req.body || {};
    if (!content) {
      return res.status(400).json({ success: false, error: "content 不能为空" });
    }

    const chatRole = view_role || "client";
    const db = readDb();

    // 获取或创建当前会话
    const { session: currentSession } = getOrCreateCurrentSession(db, chatRole);

    // 用户消息
    const userMessage = {
      id: generateId("chat"),
      role: "user",
      content: String(content),
      created_at: new Date().toISOString(),
    };

    currentSession.messages.push(userMessage);
    currentSession.updated_at = userMessage.created_at;
    autoUpdateSessionTitle(currentSession);
    writeDb(db);

    // ============================================
    // 乙方 PRD 生成指令检测
    // ============================================
    if (chatRole === "vendor") {
      const prdCommand = aiService.detectPRDCommand(content);

      if (prdCommand && prdCommand.isCommand) {
        logStep("检测到乙方 PRD 生成指令（流式）", {
          keyword: prdCommand.keyword,
          description: prdCommand.description.slice(0, 50),
        });

        const vendorPersona = db.personas?.vendor || DEFAULT_DB.personas.vendor;
        const sessionId = currentSession.id;
        const descPreview = prdCommand.description.slice(0, 50);
        const descLong = prdCommand.description.length > 50;

        // 一旦进入 PRD 生成流程，立即清空评论（不依赖流结束，避免流异常时评论仍残留）
        const dbForClear = readDb();
        dbForClear.comments = [];
        writeDb(dbForClear);
        logStep("PRD 生成开始，已清空旧评论");

        // SSE 流式响应
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        let fullContent = "";

        try {
          for await (const chunk of aiService.generatePRDStream(prdCommand.description, vendorPersona)) {
            fullContent += chunk;
            res.write("data: " + JSON.stringify({ type: "delta", content: chunk }) + "\n\n");
          }

          // ==================== 修复开始 ====================
          // 原有逻辑是分两次 readDb/writeDb，现在合并为一次原子操作

          const db = readDb(); // 读取最新数据库状态

          // 1. 更新 PRD 上下文并强制清空评论
          db.project_context = {
            ...db.project_context,
            prd_text: fullContent,
            generated_at: new Date().toISOString(),
            generated_from: prdCommand.description.slice(0, 100),
          };
          db.comments = []; // 核心修复：确保在此次最终写入中评论被清空

          // 2. 添加助手消息
          const assistantMessage = {
            id: generateId("chat"),
            role: "assistant",
            content: `✅ PRD 文档已生成完成！\n\n根据您的需求描述「${descPreview}${descLong ? "..." : ""}」，我已生成了一份完整的 PRD 文档。\n\n📄 请在右侧「PRD 文档预览」区域查看完整内容。\n\n如需修改或补充，请随时告诉我。`,
            created_at: new Date().toISOString(),
          };

          const { session } = getOrCreateCurrentSession(db, chatRole);
          session.messages.push(assistantMessage);
          session.updated_at = assistantMessage.created_at;

          // 3. 统一写入磁盘
          writeDb(db);

          logStep("PRD 流式生成完成并保存", { sessionId, prdLength: fullContent.length });
          // ==================== 修复结束 ====================

          res.write("data: " + JSON.stringify({ type: "done", prd_content: fullContent, session_id: sessionId, prd_description: prdCommand.description }) + "\n\n");
        } catch (streamErr) {
          logStep("PRD 流式生成失败", { error: String(streamErr) });
          res.write("data: " + JSON.stringify({ type: "error", error: streamErr.message || String(streamErr) }) + "\n\n");
        }

        res.end();
        return;
      }
    }

    // ============================================
    // 普通聊天消息处理
    // ============================================

    // 生成 AI 回复（根据角色使用不同的 persona）
    const history = currentSession.messages.slice(-10).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    // 根据角色获取对应的 persona 和 AI 配置
    const persona = chatRole === "vendor"
      ? db.personas?.vendor || DEFAULT_DB.personas.vendor
      : db.personas?.client || DEFAULT_DB.personas.client;

    const aiConfig = chatRole === "vendor"
      ? db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG
      : db.client_ai_config || DEFAULT_CLIENT_AI_CONFIG;

    // 构建带角色上下文的系统提示
    const roleContext = chatRole === "vendor"
      ? "你是乙方（供应商/开发方）的 AI 助手，帮助乙方理解需求、回复甲方评论、解决项目问题。"
      : "你是甲方（客户/需求方）的 AI 助手，帮助甲方审查文档、发现问题、提出改进意见。";

    const aiReply = await aiService.chat(content, history.slice(0, -1), roleContext);

    const assistantMessage = {
      id: generateId("chat"),
      role: "assistant",
      content: aiReply,
      created_at: new Date().toISOString(),
    };

    // 重新读取数据库以获取最新状态
    const updatedDb = readDb();
    const { session: updatedSession } = getOrCreateCurrentSession(updatedDb, chatRole);
    updatedSession.messages.push(assistantMessage);
    updatedSession.updated_at = assistantMessage.created_at;
    writeDb(updatedDb);

    logStep(`[${chatRole}] Chat 消息`, {
      sessionId: currentSession.id,
      userContent: content.slice(0, 50),
    });

    res.json({
      success: true,
      data: {
        type: "chat",  // 普通聊天类型
        userMessage,
        assistantMessage,
        session_id: currentSession.id,
      },
    });
  } catch (error) {
    logStep("Chat Send 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: Chat 消息 - 获取当前会话消息列表
// ============================================

app.get("/api/chat/messages", (req, res) => {
  try {
    const db = readDb();
    const since = req.query.since; // 时间戳，用于增量获取
    const viewRole = req.query.view_role || "client";
    const { currentIdKey } = getSessionKeys(viewRole);

    // 获取或创建当前会话
    const { session: currentSession, modified } = getOrCreateCurrentSession(db, viewRole);
    if (modified) {
      writeDb(db);
    }

    let messages = currentSession.messages || [];

    if (since) {
      messages = messages.filter((m) => new Date(m.created_at) > new Date(since));
    }

    res.json({
      success: true,
      data: {
        messages,
        total: currentSession.messages?.length || 0,
        view_role: viewRole,
        session_id: currentSession.id,
        session_title: currentSession.title,
      },
    });
  } catch (error) {
    logStep("获取 Chat 消息失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: Chat 消息 - 新建对话（创建新会话并切换）
// ============================================

app.post("/api/chat/clear", (req, res) => {
  try {
    const { view_role } = req.body || {};
    const chatRole = view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(chatRole);

    const db = readDb();

    // 创建新会话
    const newSession = createSession(chatRole);
    if (!db[sessionsKey]) db[sessionsKey] = [];
    db[sessionsKey].push(newSession);
    db[currentIdKey] = newSession.id;
    writeDb(db);

    logStep(`新建 ${roleName} 对话`, { sessionId: newSession.id });

    res.json({
      success: true,
      data: {
        message: `已创建新对话`,
        session_id: newSession.id,
        session_title: newSession.title,
        view_role: chatRole,
      },
    });
  } catch (error) {
    logStep("新建对话失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 获取评论列表
// ============================================

app.get("/api/comments", (req, res) => {
  try {
    const db = readDb();
    const since = req.query.since;

    let comments = db.comments || [];

    if (since) {
      comments = comments.filter((c) => new Date(c.created_at) > new Date(since));
    }

    res.json({
      success: true,
      data: {
        comments,
        total: db.comments?.length || 0,
      },
    });
  } catch (error) {
    logStep("获取评论列表失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 创建评论（文档选中评论持久化）
// ============================================

app.post("/api/comments", (req, res) => {
  try {
    const { content, quote, quoted_text, author_type, risk_level, target_id } = req.body || {};
    const db = readDb();
    const quotedText = (quote ?? quoted_text ?? "").trim();
    const comment = {
      id: generateId("comment"),
      author_type: author_type || AUTHOR_TYPES.HUMAN_CLIENT,
      content: String(content ?? "").trim() || "(无内容)",
      target_user_id: "",
      risk_level: risk_level || "low",
      quoted_text: quotedText,
      target_id: target_id || null,  // Native ID Generation: capture UI/document target
      reply_content: "",
      reply_author_type: null,
      created_at: new Date().toISOString(),
    };
    db.comments = db.comments || [];
    db.comments.push(comment);
    writeDb(db);
    logStep("创建评论（选中文本）", { id: comment.id, author_type: comment.author_type });
    res.json({ success: true, data: comment });
  } catch (error) {
    logStep("创建评论失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 回复评论（甲乙双方都可以回复任何评论）
// ============================================

app.post("/api/comments/:id/reply", (req, res) => {
  try {
    const { id } = req.params;
    const { reply_content, view_role } = req.body || {};

    if (!reply_content || !reply_content.trim()) {
      return res.status(400).json({ success: false, error: "回复内容不能为空" });
    }

    const db = readDb();
    const comment = db.comments.find(c => c.id === id);

    if (!comment) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    // 根据 view_role 确定回复者类型
    const reply_author_type = view_role === 'vendor' ? 'HUMAN_VENDOR' : 'HUMAN_CLIENT';

    // 更新评论的回复内容
    comment.reply_content = reply_content.trim();
    comment.reply_author_type = reply_author_type;
    comment.reply_created_at = new Date().toISOString();

    writeDb(db);

    logStep("回复评论", { id, reply_author_type, view_role });
    res.json({ success: true, data: comment });
  } catch (error) {
    logStep("回复评论失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 删除评论（带隔离：甲方只能删甲方/甲方AI，乙方只能删乙方/乙方AI）
// ============================================

app.delete("/api/comments/:id", (req, res) => {
  try {
    const { id } = req.params;
    const view_role = req.query.view_role || "client";
    const db = readDb();

    const index = db.comments.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    const comment = db.comments[index];

    // 删除权限隔离
    const clientTypes = [AUTHOR_TYPES.AI_CLIENT, AUTHOR_TYPES.HUMAN_CLIENT];
    const vendorTypes = [AUTHOR_TYPES.AI_VENDOR, AUTHOR_TYPES.HUMAN_VENDOR];

    if (view_role === 'client' && !clientTypes.includes(comment.author_type)) {
      return res.status(403).json({ success: false, error: "无权删除乙方评论" });
    }
    if (view_role === 'vendor' && !vendorTypes.includes(comment.author_type)) {
      return res.status(403).json({ success: false, error: "无权删除甲方评论" });
    }

    db.comments.splice(index, 1);
    writeDb(db);

    logStep("删除评论", { id, view_role, author_type: comment.author_type });
    res.json({ success: true, data: { deleted_id: id } });
  } catch (error) {
    logStep("删除评论失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 清空数据（开发用）
// ============================================

app.post("/api/debug/reset", (req, res) => {
  try {
    const { keep_config } = req.body || {};
    const db = readDb();

    const newDb = {
      ...DEFAULT_DB,
      personas: keep_config ? db.personas : DEFAULT_DB.personas,
      client_ai_config: keep_config ? db.client_ai_config : DEFAULT_CLIENT_AI_CONFIG,
      vendor_ai_config: keep_config ? db.vendor_ai_config : DEFAULT_VENDOR_AI_CONFIG,
    };

    writeDb(newDb);
    logStep("重置数据库", { keep_config });

    res.json({ success: true, message: "数据已重置" });
  } catch (error) {
    logStep("重置失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: Persona 配置
// ============================================

app.post("/api/config/persona", async (req, res) => {
  try {
    const { client, vendor } = req.body || {};
    const db = readDb();
    db.personas = {
      client: client ? String(client) : db.personas?.client || DEFAULT_DB.personas.client,
      vendor: vendor ? String(vendor) : db.personas?.vendor || DEFAULT_DB.personas.vendor,
    };
    writeDb(db);
    logStep("更新 persona 配置", db.personas);
    res.json({ success: true, data: db.personas });
  } catch (error) {
    logStep("更新 persona 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: AI 配置
// ============================================

function mergeAiConfig(existing, incoming, defaultConfig) {
  const def = defaultConfig || {};
  return {
    cognitive_engine: {
      thinking_budget:
        incoming?.cognitive_engine?.thinking_budget ??
        existing?.cognitive_engine?.thinking_budget ??
        def.cognitive_engine?.thinking_budget ?? 0.5,
      self_reflection_loops:
        incoming?.cognitive_engine?.self_reflection_loops ??
        existing?.cognitive_engine?.self_reflection_loops ??
        def.cognitive_engine?.self_reflection_loops ?? 2,
    },
    grounding: {
      strictness:
        incoming?.grounding?.strictness ??
        existing?.grounding?.strictness ??
        def.grounding?.strictness ?? 0.5,
      context_project_code:
        incoming?.grounding?.context_project_code ??
        existing?.grounding?.context_project_code ??
        def.grounding?.context_project_code ?? true,
      context_arch_doc:
        incoming?.grounding?.context_arch_doc ??
        existing?.grounding?.context_arch_doc ??
        def.grounding?.context_arch_doc ?? false,
      context_web_search:
        incoming?.grounding?.context_web_search ??
        existing?.grounding?.context_web_search ??
        def.grounding?.context_web_search ?? false,
    },
    agency: {
      code_sandbox_enabled:
        incoming?.agency?.code_sandbox_enabled ??
        existing?.agency?.code_sandbox_enabled ??
        def.agency?.code_sandbox_enabled ?? false,
      output_format:
        incoming?.agency?.output_format ??
        existing?.agency?.output_format ??
        def.agency?.output_format ?? "markdown_report",
    },
    reviewer_mode: {
      focus:
        Array.isArray(incoming?.reviewer_mode?.focus)
          ? incoming.reviewer_mode.focus
          : Array.isArray(existing?.reviewer_mode?.focus)
            ? existing.reviewer_mode.focus
            : def.reviewer_mode?.focus ?? ["逻辑漏洞", "合规风险"],
      strictness:
        incoming?.reviewer_mode?.strictness ??
        existing?.reviewer_mode?.strictness ??
        def.reviewer_mode?.strictness ?? 0.5,
    },
    replier_mode: {
      stance:
        incoming?.replier_mode?.stance ??
        existing?.replier_mode?.stance ??
        def.replier_mode?.stance ?? "discuss",
      grounding_doc:
        incoming?.replier_mode?.grounding_doc ??
        existing?.replier_mode?.grounding_doc ??
        def.replier_mode?.grounding_doc ?? true,
      grounding_sop:
        incoming?.replier_mode?.grounding_sop ??
        existing?.replier_mode?.grounding_sop ??
        def.replier_mode?.grounding_sop ?? false,
    },
  };
}

app.get("/api/config/ai", (req, res) => {
  try {
    const db = readDb();
    const role = req.query.role || "all";

    if (role === "client") {
      const config = db.client_ai_config || DEFAULT_CLIENT_AI_CONFIG;
      res.json({ success: true, data: config });
    } else if (role === "vendor") {
      const config = db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;
      res.json({ success: true, data: config });
    } else {
      res.json({
        success: true,
        data: {
          client: db.client_ai_config || DEFAULT_CLIENT_AI_CONFIG,
          vendor: db.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG,
        },
      });
    }
  } catch (error) {
    logStep("获取 AI 配置失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.post("/api/config/ai", (req, res) => {
  try {
    const db = readDb();
    const { role, config } = req.body || {};

    if (!role || !["client", "vendor"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "请指定 role 参数（client 或 vendor）",
      });
    }

    const configKey = role === "client" ? "client_ai_config" : "vendor_ai_config";
    const defaultConfig = role === "client" ? DEFAULT_CLIENT_AI_CONFIG : DEFAULT_VENDOR_AI_CONFIG;

    db[configKey] = mergeAiConfig(db[configKey], config, defaultConfig);

    writeDb(db);
    logStep(`更新 ${role} AI 配置`, db[configKey]);
    res.json({ success: true, data: db[configKey] });
  } catch (error) {
    logStep("更新 AI 配置失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.post("/api/config/ai/batch", (req, res) => {
  try {
    const db = readDb();
    const { client, vendor } = req.body || {};

    if (client) {
      db.client_ai_config = mergeAiConfig(db.client_ai_config, client, DEFAULT_CLIENT_AI_CONFIG);
    }
    if (vendor) {
      db.vendor_ai_config = mergeAiConfig(db.vendor_ai_config, vendor, DEFAULT_VENDOR_AI_CONFIG);
    }

    writeDb(db);
    logStep("批量更新 AI 配置", { client: db.client_ai_config, vendor: db.vendor_ai_config });
    res.json({
      success: true,
      data: {
        client: db.client_ai_config,
        vendor: db.vendor_ai_config,
      },
    });
  } catch (error) {
    logStep("批量更新 AI 配置失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 获取乙方回复规则
// ============================================

app.get("/api/config/vendor-rules", (req, res) => {
  res.json({
    success: true,
    data: {
      ...VENDOR_REPLY_RULES,
      author_types: AUTHOR_TYPES,
    },
  });
});

// ============================================
// API: Debug - 查看数据库
// ============================================

app.get("/api/debug/db", async (req, res) => {
  try {
    const db = readDb();
    const aiStatus = aiService.getStatus();
    res.json({
      success: true,
      data: {
        ...db,
        _ai_status: aiStatus,
        _vendor_reply_rules: VENDOR_REPLY_RULES,
      },
    });
  } catch (error) {
    logStep("读取 db 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// 错误处理
// ============================================

app.use((err, req, res, next) => {
  logStep("未捕获错误", { error: String(err) });
  res.status(500).json({ success: false, error: "内部错误" });
});

// ============================================
// 启动服务
// ============================================

ensureDbFile();

// 从 db.json 恢复模型配置（持久化），并清除可能存在的 Kimi API Key 明文
try {
  const db = readDb();
  if (db.model_config) {
    if (db.model_config.kimi?.apiKey) {
      db.model_config.kimi.apiKey = "";
      writeDb(db);
      logStep("已从 db.json 中移除 Kimi API Key（请使用 .env 的 KIMI_API_KEY）");
    }
    aiService.initRuntimeConfig(db.model_config);
    logStep("已从 db.json 恢复模型配置", { provider: db.model_config.provider });
  }
} catch (error) {
  logStep("恢复模型配置失败，使用默认配置", { error: String(error) });
}

const aiStatus = aiService.getStatus();
logStep(`AI 服务状态`, aiStatus);

const server = app.listen(PORT, () => {
  logStep(`服务已启动 http://localhost:${PORT}`);
  logStep(`AI Provider: ${aiStatus.provider}, Model: ${aiStatus.model}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logStep(`端口 ${PORT} 已被占用，请关闭占用该端口的进程或设置 PORT=其他端口 后重试`);
  } else {
    logStep("服务启动失败", { error: String(err) });
  }
  process.exitCode = 1;
});
