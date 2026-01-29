# AI 协作博弈剧场

> 甲方 AI vs 乙方 AI —— 一个模拟甲乙方协作对抗的全栈演示项目

## 🎯 项目简介

这是一个基于 AI 角色扮演的协作模拟系统：
- **甲方 AI**：挑剔的技术总监，会对 PRD 文档进行严格审查
- **乙方 AI**：卑微的项目经理，会对甲方的质疑进行回复

## 🛠 技术栈

### 后端
- Node.js + Express
- OpenAI SDK (DeepSeek API)
- 本地 JSON 文件持久化
- Multer 文件上传

### 前端
- React 18 + Vite
- Tailwind CSS (极简 Apple 风格)
- Axios
- Lucide React 图标库

## 📦 快速启动

### 1. 安装依赖

```powershell
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
PORT=3000
```

或在 PowerShell 中直接设置：

```powershell
$env:DEEPSEEK_API_KEY="your_api_key"
```

### 3. 启动后端服务

```powershell
npm run server
```

服务将在 `http://localhost:3000` 启动

### 4. 启动前端开发服务器

新开一个终端：

```powershell
npm run dev
```

前端将在 `http://localhost:5173` 启动，自动代理后端 API

## 🎮 使用指南

### 基础流程

1. **配置项目**
   - 在左侧栏输入或上传 PRD 文档
   - 可选：修改甲方/乙方的人格设定

2. **开始审查**
   - 点击"开始审查"按钮
   - 甲方 AI 会分析文档并生成审查意见
   - 所有评论会显示在中间的聊天流中

3. **模拟真人评论**
   - 在底部输入框输入评论内容
   - 发送后，乙方 AI 会自动生成回复

4. **调试模式**
   - 点击右上角"调试面板"查看原始数据
   - 实时查看数据库状态和统计信息

5. **🎨 AI 聊天界面设计预览**
   - 点击顶部导航栏的"AI 聊天界面"按钮
   - 或直接访问 `http://localhost:5173/chat.html`
   - 查看从 Figma 导入的现代化 AI 聊天界面设计

### API 接口

#### 1. 甲方审查
```bash
POST /api/client/review
Content-Type: application/json

{
  "prd_text": "你的 PRD 文档内容"
}
```

或上传文件：
```bash
POST /api/client/review
Content-Type: multipart/form-data

FormData: prd_file=@path/to/file.txt
```

#### 2. 真人评论（触发乙方回复）
```bash
POST /api/vendor/handle-comment
Content-Type: application/json

{
  "comment_content": "这块进度能保证吗？",
  "author": "REAL_HUMAN_CLIENT"
}
```

#### 3. 更新人格配置
```bash
POST /api/config/persona
Content-Type: application/json

{
  "client": "暴躁技术总监",
  "vendor": "温和项目经理"
}
```

#### 4. 查看数据库
```bash
GET /api/debug/db
```

## 📂 项目结构

```
.
├── server.js              # 后端主文件
├── package.json           # 依赖配置
├── vite.config.js         # Vite 配置（支持多页面）
├── tailwind.config.js     # Tailwind 配置
├── index.html             # 主应用 HTML 入口
├── chat.html              # AI 聊天界面 HTML 入口
├── src/
│   ├── main.jsx          # 主应用 React 入口
│   ├── chat-main.jsx     # AI 聊天界面 React 入口
│   ├── App.jsx           # 主应用组件
│   ├── AiChatDashboard.jsx  # AI 聊天界面组件（Figma 设计）
│   ├── svg-icons.jsx     # SVG 图标组件
│   └── index.css         # 全局样式
├── assets/               # 设计资源（图片、SVG）
└── data/
    ├── db.json           # 数据库文件（自动生成）
    └── uploads/          # 上传文件目录（自动生成）
```

## 🔧 数据持久化

所有数据存储在 `data/db.json` 中，包括：
- `project_context`: PRD 文档内容和路径
- `personas`: 甲乙方人格设定
- `comments`: 所有评论记录（AI + 真人）

服务重启后数据不会丢失。

## 🎨 UI 设计理念

- **极简主义**：大量留白，简洁布局
- **Apple 风格**：细边框、柔和阴影、流畅交互
- **色彩系统**：黑白灰为主，甲方用橙红色（压迫感），乙方用蓝色（回复）
- **响应式**：支持桌面和平板设备

## 🐛 调试技巧

1. **查看实时日志**：后端控制台会显示所有 API 调用和 AI 推理步骤
2. **检查数据库**：直接打开 `data/db.json` 查看原始数据
3. **调试面板**：前端右侧显示实时数据库状态和统计信息
4. **手动修改数据**：可以直接编辑 `db.json`，重启后生效

## ⚠️ 注意事项

- 确保 DeepSeek API Key 有效且有额度
- PRD 文档不要过长（建议 < 5000 字），避免 token 超限
- 本地 JSON 文件不适合生产环境，仅用于演示

## 📝 License

MIT

---

**Enjoy coding!** 🚀
