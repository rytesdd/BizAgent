const express = require("express");
const fs = require("fs");
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

// 默认 AI 配置
const DEFAULT_CLIENT_AI_CONFIG = {
  cognitive_control: {
    temperature: 0.7,
    reasoning_depth: "chain_of_thought",
  },
  expression_control: {
    aggression_threshold: 0.7,
    information_density: 0.5,
  },
  strategy_control: {
    context_grounding: "current_document",
  },
};

const DEFAULT_VENDOR_AI_CONFIG = {
  cognitive_control: {
    temperature: 0.4,
    reasoning_depth: "intuitive",
  },
  expression_control: {
    aggression_threshold: 0.2,
    information_density: 0.7,
  },
  strategy_control: {
    context_grounding: "current_document",
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
// 数据库操作
// ============================================

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

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    logStep("readDb 解析失败，触发修复", { error: String(e) });
    ensureDbFile(); // 会走 catch 写入 DEFAULT_DB
    const retry = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(retry);
  }
}

function writeDb(db) {
  ensureDbFile();
  const tempPath = `${DB_PATH}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tempPath, DB_PATH);
  } catch (error) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    logStep("写入 db.json (fallback)", { error: String(error) });
  }
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
 */
function getOrCreateCurrentSession(db, viewRole) {
  const { sessionsKey, currentIdKey, legacyKey, roleName } = getSessionKeys(viewRole);
  
  // 确保会话数组存在
  if (!db[sessionsKey]) {
    db[sessionsKey] = [];
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
  }
  
  return currentSession;
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
    risk_level: String(item?.risk_level || "medium"),
    quoted_text: String(item?.quoted_text || "").trim(), // 被评论的 PRD 原文片段，用于前端黄色下划线与点击定位
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
      risk_level: "medium",
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
// API: 会话管理 - 获取会话列表
// ============================================

app.get("/api/chat/sessions", (req, res) => {
  try {
    const db = readDb();
    const viewRole = req.query.view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(viewRole);
    
    // 确保当前会话存在（触发迁移逻辑）
    getOrCreateCurrentSession(db, viewRole);
    writeDb(db);
    
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
    const currentSession = getOrCreateCurrentSession(db, chatRole);
    
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

          const session = getOrCreateCurrentSession(db, chatRole);
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
    const updatedSession = getOrCreateCurrentSession(updatedDb, chatRole);
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
    const currentSession = getOrCreateCurrentSession(db, viewRole);
    writeDb(db);
    
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
  return {
    cognitive_control: {
      temperature:
        incoming?.cognitive_control?.temperature ??
        existing?.cognitive_control?.temperature ??
        defaultConfig.cognitive_control.temperature,
      reasoning_depth:
        incoming?.cognitive_control?.reasoning_depth ??
        existing?.cognitive_control?.reasoning_depth ??
        defaultConfig.cognitive_control.reasoning_depth,
    },
    expression_control: {
      aggression_threshold:
        incoming?.expression_control?.aggression_threshold ??
        existing?.expression_control?.aggression_threshold ??
        defaultConfig.expression_control.aggression_threshold,
      information_density:
        incoming?.expression_control?.information_density ??
        existing?.expression_control?.information_density ??
        defaultConfig.expression_control.information_density,
    },
    strategy_control: {
      context_grounding:
        incoming?.strategy_control?.context_grounding ??
        existing?.strategy_control?.context_grounding ??
        defaultConfig.strategy_control.context_grounding,
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

app.listen(PORT, () => {
  logStep(`服务已启动 http://localhost:${PORT}`);
  logStep(`AI Provider: ${aiStatus.provider}, Model: ${aiStatus.model}`);
});
