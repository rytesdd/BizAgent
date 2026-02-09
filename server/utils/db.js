/**
 * 数据访问层 (DAO) - 线程安全的 JSON 数据库操作
 * 
 * 使用 async-mutex 实现并发锁，防止多个请求同时读写 db.json 导致数据损坏。
 * 所有数据库操作都应通过此模块进行。
 */

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { Mutex } = require("async-mutex");

// ============================================
// 常量定义
// ============================================

const DATA_DIR = path.join(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "db_temp.json"); // Temporary Switch due to permission issue on db.json
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// 评论来源类型常量
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

// 乙方回复规则配置
const VENDOR_REPLY_RULES = {
    // 是否允许乙方 AI 回复甲方 AI 的评论
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
    // 项目元数据 (供 Agentic Router 的 query_db 工具使用)
    project_meta: {
        project_name: "BizAgent AI 协作平台",
        version: "1.0.0",
        progress: "开发阶段 (45%)",
        stakeholders: {
            client: "张总 (CTO)",
            vendor: "李工 (PM)",
        },
        current_stage: "API 接口开发与联调",
    },
    personas: {
        client: "挑剔技术总监",
        vendor: "卑微项目经理",
    },
    client_ai_config: DEFAULT_CLIENT_AI_CONFIG,
    vendor_ai_config: DEFAULT_VENDOR_AI_CONFIG,
    // 模型配置（持久化）
    model_config: {
        provider: "kimi",
        ollama: { model: "qwen3-vl:8b" },
        kimi: { model: "moonshot-v1-32k", apiKey: "" },
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

// ============================================
// Database 类 - 线程安全的数据库操作
// ============================================

class Database {
    constructor() {
        /** 互斥锁，确保同一时间只有一个操作在读写数据库 */
        this.mutex = new Mutex();

        /** 内存中的 db 副本，GET 请求直接读缓存，减少磁盘 I/O */
        this.cache = null;

        /** 防抖：距上次 writeDb 1 秒后再写盘，避免频繁同步写阻塞主线程 */
        this.DEBOUNCE_WRITE_MS = 1000;
        this.writeTimeoutId = null;

        // 初始化时确保数据库文件存在
        this._ensureDbFile();
    }

    // ============================================
    // 私有方法
    // ============================================

    /**
     * 确保目录存在
     */
    _ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            this._log("创建目录", { dirPath });
        }
    }

    /**
     * 确保数据库文件存在
     */
    _ensureDbFile() {
        this._ensureDir(DATA_DIR);
        this._ensureDir(UPLOAD_DIR);

        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
            this._log("初始化 db.json", { DB_PATH });
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
            this._log("修复损坏 db.json", { backupPath, error: String(error) });
        }
    }

    /**
     * 日志工具
     */
    _log(message, meta) {
        const timestamp = new Date().toISOString();
        if (meta) {
            console.log(`[${timestamp}] [DB] ${message}`, meta);
            return;
        }
        console.log(`[${timestamp}] [DB] ${message}`);
    }

    /**
     * 实际写盘（异步），仅由 debouncedFlushDb 调用
     */
    async _flushToDisk() {
        if (this.cache === null) return;

        const toWrite = JSON.stringify(this.cache, null, 2);
        const tempPath = `${DB_PATH}.tmp`;

        try {
            await fsp.writeFile(tempPath, toWrite, "utf8");
            await fsp.rename(tempPath, DB_PATH);
            this._log("db.json 已异步落盘");
        } catch (err) {
            try {
                await fsp.writeFile(DB_PATH, toWrite, "utf8");
            } catch { }
            try {
                await fsp.unlink(tempPath);
            } catch { }
            this._log("db.json 异步落盘失败，已回退写主文件", { error: String(err) });
        }
    }

    /**
     * 防抖：1 秒内多次 writeDb 只触发一次落盘
     */
    _debouncedFlush() {
        if (this.writeTimeoutId) clearTimeout(this.writeTimeoutId);
        this.writeTimeoutId = setTimeout(() => {
            this.writeTimeoutId = null;
            this._flushToDisk();
        }, this.DEBOUNCE_WRITE_MS);
    }

    // ============================================
    // 公共方法（线程安全）
    // ============================================

    /**
     * 读取数据库（线程安全）
     * @returns {Object} 数据库对象的深拷贝
     */
    read() {
        // 读操作不需要互斥锁，因为我们返回的是深拷贝
        // 但需要确保 cache 已初始化
        if (this.cache !== null) {
            return JSON.parse(JSON.stringify(this.cache));
        }

        this._ensureDbFile();
        const raw = fs.readFileSync(DB_PATH, "utf8");
        try {
            const parsed = JSON.parse(raw);
            this.cache = parsed;
            return JSON.parse(JSON.stringify(parsed));
        } catch (e) {
            this._log("read 解析失败，触发修复", { error: String(e) });
            this._ensureDbFile();
            const retry = fs.readFileSync(DB_PATH, "utf8");
            const parsed = JSON.parse(retry);
            this.cache = parsed;
            return JSON.parse(JSON.stringify(parsed));
        }
    }

    /**
     * 写入数据库（线程安全）
     * @param {Object} db - 要写入的数据库对象
     */
    write(db) {
        this._ensureDbFile();
        this.cache = db;
        this._debouncedFlush();
    }

    /**
     * 原子性读写操作（线程安全）
     * 使用互斥锁确保读-修改-写操作的原子性
     * 
     * @param {Function} callback - 回调函数，接收当前 db 对象，返回修改后的 db 对象或 void
     * @returns {Promise<any>} 回调函数的返回值
     * 
     * @example
     * // 原子性增加评论
     * await db.runExclusive((data) => {
     *   data.comments.push(newComment);
     *   return data;
     * });
     */
    async runExclusive(callback) {
        return this.mutex.runExclusive(async () => {
            const db = this.read();
            const result = await callback(db);

            // 如果回调返回了对象，则写入
            if (result && typeof result === "object") {
                this.write(result);
            }

            return result;
        });
    }

    /**
     * 强制立即刷新缓存到磁盘（用于关键操作）
     */
    async forceFlush() {
        if (this.writeTimeoutId) {
            clearTimeout(this.writeTimeoutId);
            this.writeTimeoutId = null;
        }
        await this._flushToDisk();
    }

    // ============================================
    // 工具方法
    // ============================================

    /**
     * 生成唯一 ID
     */
    generateId(prefix = "msg") {
        return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }

    /**
     * 获取会话配置 key
     */
    getSessionKeys(viewRole) {
        const isVendor = viewRole === "vendor";
        return {
            sessionsKey: isVendor ? "vendor_chat_sessions" : "client_chat_sessions",
            currentIdKey: isVendor ? "current_vendor_session_id" : "current_client_session_id",
            legacyKey: isVendor ? "vendor_chat_messages" : "client_chat_messages",
            roleName: isVendor ? "乙方" : "甲方",
        };
    }

    /**
     * 创建新会话
     */
    createSession(viewRole, title = "") {
        const now = new Date().toISOString();
        return {
            id: this.generateId("session"),
            title: title || `新对话 ${new Date().toLocaleString("zh-CN")}`,
            view_role: viewRole,
            created_at: now,
            updated_at: now,
            messages: [],
        };
    }

    /**
     * 获取或创建当前会话
     * 包含旧数据迁移逻辑
     * 返回: { session: Object, modified: boolean }
     */
    getOrCreateCurrentSession(db, viewRole) {
        const { sessionsKey, currentIdKey, legacyKey, roleName } = this.getSessionKeys(viewRole);
        let modified = false;

        // 确保会话数组存在
        if (!db[sessionsKey]) {
            db[sessionsKey] = [];
        }

        // 迁移旧数据（如果存在）
        const legacyMessages = db[legacyKey] || [];
        if (legacyMessages.length > 0 && db[sessionsKey].length === 0) {
            const migratedSession = this.createSession(viewRole, `历史对话（已迁移）`);
            migratedSession.messages = legacyMessages;
            migratedSession.updated_at = legacyMessages[legacyMessages.length - 1]?.created_at || migratedSession.created_at;
            db[sessionsKey].push(migratedSession);
            db[currentIdKey] = migratedSession.id;
            db[legacyKey] = []; // 清空旧数据
            this._log(`迁移 ${roleName} 旧聊天记录到会话`, { messageCount: legacyMessages.length, sessionId: migratedSession.id });
            modified = true;
        }

        // 获取当前会话
        let currentSession = null;
        if (db[currentIdKey]) {
            currentSession = db[sessionsKey].find(s => s.id === db[currentIdKey]);
        }

        // 如果没有当前会话，创建一个新的
        if (!currentSession) {
            currentSession = this.createSession(viewRole);
            db[sessionsKey].push(currentSession);
            db[currentIdKey] = currentSession.id;
            this._log(`创建新 ${roleName} 会话`, { sessionId: currentSession.id });
            modified = true;
        }

        return { session: currentSession, modified };
    }

    /**
     * 自动更新会话标题（基于第一条用户消息）
     */
    autoUpdateSessionTitle(session) {
        if (session.title.startsWith("新对话") && session.messages.length > 0) {
            const firstUserMsg = session.messages.find(m => m.role === "user");
            if (firstUserMsg) {
                // 取前 20 个字符作为标题
                const content = firstUserMsg.content.trim();
                session.title = content.length > 20 ? content.slice(0, 20) + "..." : content;
            }
        }
    }

    /**
     * 检查是否允许乙方 AI 回复该评论
     */
    canVendorAiReply(comment) {
        const authorType = comment.author_type;

        // 如果是甲方 AI 评论
        if (authorType === AUTHOR_TYPES.AI_CLIENT) {
            return VENDOR_REPLY_RULES.allowReplyToAiClient;
        }

        // 检查是否在允许列表中
        return VENDOR_REPLY_RULES.allowedClientTypes.includes(authorType);
    }

    /**
     * 标准化评论项
     */
    normalizeCommentItem(item, index) {
        return {
            id: this.generateId("comment"),
            author_type: AUTHOR_TYPES.AI_CLIENT, // 甲方 AI 评论
            content: String(item?.content || "").trim(),
            target_user_id: String(item?.at_user || "").trim(),
            quoted_text: String(item?.quoted_text || "").trim(),
            target_id: item?.target_id || null,
            reply_content: "",
            reply_author_type: null,
            created_at: new Date().toISOString(),
        };
    }

    /**
     * 合并 AI 配置
     */
    mergeAiConfig(existing, incoming, defaultConfig) {
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

    // ============================================
    // Getters
    // ============================================

    get paths() {
        return { DATA_DIR, DB_PATH, UPLOAD_DIR };
    }

    get constants() {
        return {
            AUTHOR_TYPES,
            VENDOR_REPLY_RULES,
            DEFAULT_DB,
            DEFAULT_CLIENT_AI_CONFIG,
            DEFAULT_VENDOR_AI_CONFIG,
        };
    }
}

// 单例模式导出
const db = new Database();

module.exports = db;
