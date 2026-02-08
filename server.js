/**
 * BizAgent 后端服务入口
 * 
 * 架构重构：MVC 分层架构
 * - server/utils/db.js: 数据访问层 (DAO)，线程安全的 JSON 数据库操作
 * - server/controllers/aiController.js: AI 业务逻辑控制器
 * - server.js: 路由定义和应用入口（本文件）
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");

// 加载环境变量
dotenv.config();

// 导入数据访问层（线程安全）
const db = require("./server/utils/db");

// 导入 AI 服务层
const aiService = require("./services/aiService");
// 导入文件解析服务
const fileParser = require("./services/fileParser");
// 导入 AI 控制器
const aiController = require("./server/controllers/aiController");
// 导入配置控制器
const configController = require("./server/controllers/configController");

// ============================================
// 从数据库模块获取常量和路径
// ============================================
const { AUTHOR_TYPES, VENDOR_REPLY_RULES, DEFAULT_DB, DEFAULT_CLIENT_AI_CONFIG, DEFAULT_VENDOR_AI_CONFIG } = db.constants;
const { DATA_DIR, DB_PATH, UPLOAD_DIR } = db.paths;

// ============================================
// Express 应用配置
// ============================================
const app = express();
const PORT = process.env.PORT || 3001;

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
// 兼容层：保留旧的 readDb/writeDb 接口供未迁移的路由使用
// ============================================

function readDb() {
  return db.read();
}

function writeDb(data) {
  return db.write(data);
}

function generateId(prefix = "msg") {
  return db.generateId(prefix);
}

function createSession(viewRole, title = "") {
  return db.createSession(viewRole, title);
}

function getSessionKeys(viewRole) {
  return db.getSessionKeys(viewRole);
}

function getOrCreateCurrentSession(data, viewRole) {
  return db.getOrCreateCurrentSession(data, viewRole);
}

function autoUpdateSessionTitle(session) {
  return db.autoUpdateSessionTitle(session);
}

function normalizeCommentItem(item, index) {
  return db.normalizeCommentItem(item, index);
}

function canVendorAiReply(comment) {
  return db.canVendorAiReply(comment);
}

function mergeAiConfig(existing, incoming, defaultConfig) {
  return db.mergeAiConfig(existing, incoming, defaultConfig);
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
// API: 获取/更新模型配置（使用控制器，带 API Key 安全处理）
// ============================================

app.get("/api/ai/config", configController.getModelConfig);
app.post("/api/ai/config", configController.setModelConfig);

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
// API: 通用 AI 聊天接口（使用控制器）
// ============================================

app.post("/api/ai/chat", aiController.chat);

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
    const data = readDb();
    data.project_context = {
      prd_text: result.content,
      prd_file_path: path.relative(__dirname, filePath),
      file_name: originalName,
      file_type: result.type,
      uploaded_at: new Date().toISOString(),
    };
    data.comments = [];
    writeDb(data);

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
    const data = readDb();
    const rawText = data.project_context?.prd_text || "";
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
    const data = readDb();
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
      prdText = data.project_context?.prd_text || "";
      prdFilePath = data.project_context?.prd_file_path || "";
      logStep("使用历史 PRD 上下文");
    }

    if (!prdText.trim()) {
      return res.status(400).json({ success: false, error: "PRD 内容为空" });
    }

    data.project_context = {
      prd_text: prdText,
      prd_file_path: prdFilePath,
      file_name: fileName,
      updated_at: new Date().toISOString(),
    };
    // 评论仅跟随当前 PRD：每次审查前清空旧评论，只保留本次审查结果
    data.comments = [];

    const persona = data.personas?.client || DEFAULT_DB.personas.client;
    const aiConfig = data.client_ai_config || DEFAULT_CLIENT_AI_CONFIG;

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

    data.comments.push(...comments);
    writeDb(data);

    res.json({ success: true, data: { comments } });
  } catch (error) {
    logStep("Client Review 失败", { error: String(error) });
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// API: 处理评论（使用控制器）
// ============================================

app.post("/api/vendor/handle-comment", aiController.handleComment);

// ============================================
// API: 乙方真人回复指定评论（使用控制器）
// ============================================

app.post("/api/vendor/human-reply", aiController.humanReply);

// ============================================
// API: 手动触发乙方 AI 回复指定评论（使用控制器）
// ============================================

app.post("/api/vendor/reply", aiController.vendorReply);

// ============================================
// API: 自动触发乙方 AI 回复（使用控制器）
// ============================================

app.post("/api/vendor/auto-reply", aiController.autoReply);

// ============================================
// API: 自动触发乙方 AI 回复（SSE 流式，使用控制器）
// ============================================

app.post("/api/vendor/auto-reply-stream", aiController.autoReplyStream);

// ============================================
// API: 会话管理 - 获取会话列表
// ============================================

app.get("/api/chat/sessions", (req, res) => {
  try {
    const data = readDb();
    const viewRole = req.query.view_role || "client";
    const { sessionsKey, currentIdKey, roleName } = getSessionKeys(viewRole);

    // 确保当前会话存在（触发迁移逻辑）
    const { modified } = getOrCreateCurrentSession(data, viewRole);
    if (modified) {
      writeDb(data);
    }

    const sessions = data[sessionsKey] || [];
    const currentSessionId = data[currentIdKey];

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

    const data = readDb();

    // 创建新会话
    const newSession = createSession(viewRole, title);

    if (!data[sessionsKey]) data[sessionsKey] = [];
    data[sessionsKey].push(newSession);
    data[currentIdKey] = newSession.id;
    writeDb(data);

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

    const data = readDb();
    const sessions = data[sessionsKey] || [];
    const targetSession = sessions.find(s => s.id === session_id);

    if (!targetSession) {
      return res.status(404).json({ success: false, error: "会话不存在" });
    }

    data[currentIdKey] = session_id;
    writeDb(data);

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

    const data = readDb();
    const sessions = data[sessionsKey] || [];
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);

    if (sessionIndex === -1) {
      return res.status(404).json({ success: false, error: "会话不存在" });
    }

    const deletedSession = sessions[sessionIndex];
    sessions.splice(sessionIndex, 1);
    data[sessionsKey] = sessions;

    // 如果删除的是当前会话，切换到最新的会话或创建新会话
    if (data[currentIdKey] === sessionId) {
      if (sessions.length > 0) {
        // 切换到最新的会话
        const latestSession = sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
        data[currentIdKey] = latestSession.id;
      } else {
        // 创建新会话
        const newSession = createSession(viewRole);
        data[sessionsKey].push(newSession);
        data[currentIdKey] = newSession.id;
      }
    }

    writeDb(data);

    logStep(`删除 ${roleName} 会话`, { sessionId, title: deletedSession.title });

    res.json({
      success: true,
      data: {
        deleted_session_id: sessionId,
        current_session_id: data[currentIdKey],
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

    const data = readDb();
    const sessions = data[sessionsKey] || [];
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      return res.status(404).json({ success: false, error: "会话不存在" });
    }

    session.title = title.trim();
    session.updated_at = new Date().toISOString();
    writeDb(data);

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
    const data = readDb();

    // 获取或创建当前会话
    const { session: currentSession } = getOrCreateCurrentSession(data, chatRole);

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
    writeDb(data);

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

        const vendorPersona = data.personas?.vendor || DEFAULT_DB.personas.vendor;
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

          const dbData = readDb(); // 读取最新数据库状态

          // 1. 更新 PRD 上下文并强制清空评论
          dbData.project_context = {
            ...dbData.project_context,
            prd_text: fullContent,
            generated_at: new Date().toISOString(),
            generated_from: prdCommand.description.slice(0, 100),
          };
          dbData.comments = []; // 核心修复：确保在此次最终写入中评论被清空

          // 2. 添加助手消息
          const assistantMessage = {
            id: generateId("chat"),
            role: "assistant",
            content: `✅ PRD 文档已生成完成！\n\n根据您的需求描述「${descPreview}${descLong ? "..." : ""}」，我已生成了一份完整的 PRD 文档。\n\n📄 请在右侧「PRD 文档预览」区域查看完整内容。\n\n如需修改或补充，请随时告诉我。`,
            created_at: new Date().toISOString(),
          };

          const { session } = getOrCreateCurrentSession(dbData, chatRole);
          session.messages.push(assistantMessage);
          session.updated_at = assistantMessage.created_at;

          // 3. 统一写入磁盘
          writeDb(dbData);

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
      ? data.personas?.vendor || DEFAULT_DB.personas.vendor
      : data.personas?.client || DEFAULT_DB.personas.client;

    const aiConfig = chatRole === "vendor"
      ? data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG
      : data.client_ai_config || DEFAULT_CLIENT_AI_CONFIG;

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
    const updatedData = readDb();
    const { session: updatedSession } = getOrCreateCurrentSession(updatedData, chatRole);
    updatedSession.messages.push(assistantMessage);
    updatedSession.updated_at = assistantMessage.created_at;
    writeDb(updatedData);

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
    const data = readDb();
    const since = req.query.since; // 时间戳，用于增量获取
    const viewRole = req.query.view_role || "client";
    const { currentIdKey } = getSessionKeys(viewRole);

    // 获取或创建当前会话
    const { session: currentSession, modified } = getOrCreateCurrentSession(data, viewRole);
    if (modified) {
      writeDb(data);
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

    const data = readDb();

    // 创建新会话
    const newSession = createSession(chatRole);
    if (!data[sessionsKey]) data[sessionsKey] = [];
    data[sessionsKey].push(newSession);
    data[currentIdKey] = newSession.id;
    writeDb(data);

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
    const data = readDb();
    const since = req.query.since;

    let comments = data.comments || [];

    if (since) {
      comments = comments.filter((c) => new Date(c.created_at) > new Date(since));
    }

    res.json({
      success: true,
      data: {
        comments,
        total: data.comments?.length || 0,
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
    const data = readDb();
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
    data.comments = data.comments || [];
    data.comments.push(comment);
    writeDb(data);
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

    const data = readDb();
    const comment = data.comments.find(c => c.id === id);

    if (!comment) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    // 根据 view_role 确定回复者类型
    const reply_author_type = view_role === 'vendor' ? 'HUMAN_VENDOR' : 'HUMAN_CLIENT';

    // 更新评论的回复内容
    comment.reply_content = reply_content.trim();
    comment.reply_author_type = reply_author_type;
    comment.reply_created_at = new Date().toISOString();

    writeDb(data);

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
    const data = readDb();

    const index = data.comments.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "评论不存在" });
    }

    const comment = data.comments[index];

    // 删除权限隔离
    const clientTypes = [AUTHOR_TYPES.AI_CLIENT, AUTHOR_TYPES.HUMAN_CLIENT];
    const vendorTypes = [AUTHOR_TYPES.AI_VENDOR, AUTHOR_TYPES.HUMAN_VENDOR];

    if (view_role === 'client' && !clientTypes.includes(comment.author_type)) {
      return res.status(403).json({ success: false, error: "无权删除乙方评论" });
    }
    if (view_role === 'vendor' && !vendorTypes.includes(comment.author_type)) {
      return res.status(403).json({ success: false, error: "无权删除甲方评论" });
    }

    data.comments.splice(index, 1);
    writeDb(data);

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
    const data = readDb();

    const newDb = {
      ...DEFAULT_DB,
      personas: keep_config ? data.personas : DEFAULT_DB.personas,
      client_ai_config: keep_config ? data.client_ai_config : DEFAULT_CLIENT_AI_CONFIG,
      vendor_ai_config: keep_config ? data.vendor_ai_config : DEFAULT_VENDOR_AI_CONFIG,
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
// API: Persona 配置（使用控制器）
// ============================================

app.post("/api/config/persona", configController.setPersona);

// ============================================
// API: AI 配置（使用控制器）
// ============================================

app.get("/api/config/ai", configController.getAiConfig);
app.post("/api/config/ai", configController.setAiConfig);
app.post("/api/config/ai/batch", configController.batchSetAiConfig);

// ============================================
// API: 获取乙方回复规则（使用控制器）
// ============================================

app.get("/api/config/vendor-rules", configController.getVendorRules);

// ============================================
// API: Debug - 查看数据库
// ============================================

app.get("/api/debug/db", async (req, res) => {
  try {
    const data = readDb();
    const aiStatus = aiService.getStatus();
    res.json({
      success: true,
      data: {
        ...data,
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

// 从 db.json 恢复模型配置（持久化），并清除可能存在的 Kimi API Key 明文
try {
  const data = readDb();
  if (data.model_config) {
    if (data.model_config.kimi?.apiKey) {
      data.model_config.kimi.apiKey = "";
      writeDb(data);
      logStep("已从 db.json 中移除 Kimi API Key（请使用 .env 的 KIMI_API_KEY）");
    }
    aiService.initRuntimeConfig(data.model_config);
    logStep("已从 db.json 恢复模型配置", { provider: data.model_config.provider });
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
