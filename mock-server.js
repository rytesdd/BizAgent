const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const upload = multer({ dest: UPLOAD_DIR });

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// 确保数据目录存在
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);

// 初始化数据库
let db = {
  project_context: { prd_text: "", prd_file_path: "" },
  personas: {
    client: "挑剔技术总监",
    vendor: "卑微项目经理",
  },
  comments: [],
};

// 保存数据库
function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// 读取数据库
if (fs.existsSync(DB_PATH)) {
  db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  console.log("📂 已加载现有数据库");
} else {
  saveDb();
  console.log("✨ 已创建新数据库");
}

// 生成模拟的 AI 评论
function generateMockComments(prdText) {
  const comments = [
    {
      id: `comment-${Date.now()}-1`,
      content: "这个 PRD 的技术架构描述不够详细，需要补充具体的技术栈选型依据。",
      author_type: "AI_Auditor",
      created_at: new Date().toISOString(),
      reply_content: "好的，我们会立即补充详细的技术选型说明文档，包括各技术栈的对比分析和选择理由。",
    },
    {
      id: `comment-${Date.now()}-2`,
      content: "关于性能指标，文档中提到的响应时间要求是否考虑了高峰期的并发场景？",
      author_type: "AI_Auditor",
      created_at: new Date().toISOString(),
      reply_content: "您说得对，我们会根据预估的峰值并发量（约5000 QPS）重新评估响应时间指标。",
    },
    {
      id: `comment-${Date.now()}-3`,
      content: "数据安全方面，需要明确敏感数据的加密方案和密钥管理策略。",
      author_type: "AI_Auditor",
      created_at: new Date().toISOString(),
      reply_content: "明白！我们将采用 AES-256 加密，并使用 AWS KMS 进行密钥管理，会在文档中补充详细方案。",
    },
  ];
  return comments;
}

// 生成模拟的 AI 回复
function generateMockReply(commentContent) {
  const replies = [
    "好的，我们会马上处理这个问题，预计今天下午之前给您反馈。",
    "非常感谢您的建议！我们会认真考虑并在下个版本中优化。",
    "这个问题我们已经注意到了，正在紧急修复中。",
    "明白了，我们会补充相关的技术文档和实现细节。",
    "您说得对，我们会立即调整方案并更新文档。",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

// API: 甲方审查 PRD
app.post("/api/client/review", upload.single("prd_file"), async (req, res) => {
  try {
    console.log("📝 收到审查请求");
    
    let prdText = req.body.prd_text || "";
    
    // 如果上传了文件，读取文件内容
    if (req.file) {
      prdText = fs.readFileSync(req.file.path, "utf-8");
      db.project_context.prd_file_path = req.file.path;
    }
    
    db.project_context.prd_text = prdText;
    
    // 生成模拟评论
    const newComments = generateMockComments(prdText);
    db.comments.push(...newComments);
    
    saveDb();
    
    console.log(`✅ 生成了 ${newComments.length} 条模拟评论`);
    
    res.json({
      success: true,
      data: {
        comments: newComments,
        total: newComments.length,
      },
    });
  } catch (error) {
    console.error("❌ 审查失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API: 乙方处理评论（模拟真人评论触发 AI 回复）
app.post("/api/vendor/handle-comment", async (req, res) => {
  try {
    const { comment_content, author } = req.body;
    
    console.log("💬 收到真人评论:", comment_content);
    
    // 创建真人评论
    const humanComment = {
      id: `comment-${Date.now()}-human`,
      content: comment_content,
      author_type: author || "HUMAN_CLIENT",
      created_at: new Date().toISOString(),
      reply_content: generateMockReply(comment_content),
    };
    
    db.comments.push(humanComment);
    saveDb();
    
    console.log("✅ 已生成模拟回复");
    
    res.json({
      success: true,
      data: {
        comment: humanComment,
      },
    });
  } catch (error) {
    console.error("❌ 处理评论失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API: 保存人设配置
app.post("/api/config/persona", (req, res) => {
  try {
    const { client, vendor } = req.body;
    
    db.personas.client = client || db.personas.client;
    db.personas.vendor = vendor || db.personas.vendor;
    
    saveDb();
    
    console.log("✅ 人设配置已保存:", db.personas);
    
    res.json({
      success: true,
      data: db.personas,
    });
  } catch (error) {
    console.error("❌ 保存人设失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API: 调试 - 查看数据库
app.get("/api/debug/db", (req, res) => {
  res.json({
    success: true,
    data: db,
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log("\n🚀 模拟后端服务器已启动");
  console.log(`📡 监听端口: http://localhost:${PORT}`);
  console.log("💡 这是一个 Mock 服务，所有 AI 响应都是预设的模拟数据");
  console.log("✨ 您可以正常使用界面进行交互测试\n");
});
