/**
 * 配置控制器 - 处理所有配置相关的路由逻辑
 * 
 * 安全设计原则：
 * 1. API Key 永远不传递真实值到前端，始终返回脱敏占位符 "********"
 * 2. 前端提交 "********" 时，不覆盖现有 Key（视为"保持不变"）
 * 3. 环境变量 (.env) 优先级高于数据库配置
 * 4. db.json 中不存储任何真实 API Key
 * 
 * 包括：
 * - GET/POST /api/ai/config - 模型配置（Provider、模型选择）
 * - GET/POST /api/config/ai - AI 参数配置（温度、思考预算等）
 * - POST /api/config/ai/batch - 批量更新 AI 配置
 * - POST /api/config/persona - 人格配置
 * - GET /api/config/vendor-rules - 乙方回复规则
 */

const db = require("../utils/db");
const aiService = require("../../services/aiService");

// ============================================
// 常量
// ============================================

/** 脱敏占位符 - 用于前端显示 */
const API_KEY_MASK = "********";

// ============================================
// 日志工具
// ============================================

function logStep(message, meta) {
    const timestamp = new Date().toISOString();
    if (meta) {
        console.log(`[${timestamp}] [ConfigController] ${message}`, meta);
        return;
    }
    console.log(`[${timestamp}] [ConfigController] ${message}`);
}

// ============================================
// 模型配置 API
// ============================================

/**
 * 获取模型配置（脱敏返回）
 * GET /api/ai/config
 */
function getModelConfig(req, res) {
    try {
        const config = aiService.getRuntimeConfig();
        const status = aiService.getStatus();

        // 安全处理：API Key 脱敏
        const safeConfig = {
            ...config,
            availableModels: status.availableModels,
        };

        // Kimi API Key 脱敏
        if (safeConfig.kimi) {
            safeConfig.kimi = {
                ...safeConfig.kimi,
                apiKey: safeConfig.kimi.apiKey ? API_KEY_MASK : "",
                // 添加一个标志位，告诉前端是否已配置 Key
                hasApiKey: !!safeConfig.kimi.apiKey || !!process.env.KIMI_API_KEY,
            };
        }

        res.json({ success: true, data: safeConfig });
    } catch (error) {
        logStep("获取模型配置失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 更新模型配置（安全处理 API Key）
 * POST /api/ai/config
 */
function setModelConfig(req, res) {
    try {
        const { provider, ollama, kimi } = req.body || {};
        logStep("收到模型配置更新请求", { provider, ollama, kimiModel: kimi?.model });

        // 安全处理：检查 API Key 是否为脱敏占位符
        const safeKimiConfig = { ...kimi };
        if (safeKimiConfig.apiKey === API_KEY_MASK) {
            // 用户未修改 API Key，删除该字段以保留现有值
            delete safeKimiConfig.apiKey;
            logStep("API Key 保持不变（用户未修改）");
        } else if (safeKimiConfig.apiKey) {
            // 用户提供了新的 API Key
            logStep("检测到新的 API Key 输入");
            // 警告：不建议通过 API 设置 Key，应使用 .env
            logStep("⚠️ 安全建议：API Key 应通过 .env 文件配置，而非 API 提交");
        }

        // 1. 更新运行时配置
        const newConfig = aiService.setRuntimeConfig({
            provider,
            ollama,
            kimi: safeKimiConfig,
        });

        // 2. 持久化到 db.json（不存储 API Key）
        const data = db.read();
        data.model_config = {
            provider: newConfig.provider,
            ollama: newConfig.ollama,
            kimi: {
                model: newConfig.kimi?.model,
                // 永远不在 db.json 中存储 API Key
                apiKey: "",
            },
        };
        db.write(data);
        logStep("模型配置已持久化到 db.json（不含 API Key）");

        const status = aiService.getStatus();

        // 返回脱敏后的配置
        res.json({
            success: true,
            data: {
                provider: newConfig.provider,
                ollama: newConfig.ollama,
                kimi: {
                    model: newConfig.kimi?.model,
                    apiKey: newConfig.kimi?.apiKey ? API_KEY_MASK : "",
                    hasApiKey: !!newConfig.kimi?.apiKey || !!process.env.KIMI_API_KEY,
                },
                currentModel: status.model,
                isReady: status.isReady,
            },
        });
    } catch (error) {
        logStep("更新模型配置失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

// ============================================
// AI 参数配置 API
// ============================================

/**
 * 获取 AI 参数配置
 * GET /api/config/ai
 */
function getAiConfig(req, res) {
    try {
        const data = db.read();
        const role = req.query.role || "all";
        const { DEFAULT_CLIENT_AI_CONFIG, DEFAULT_VENDOR_AI_CONFIG } = db.constants;

        if (role === "client") {
            const config = data.client_ai_config || DEFAULT_CLIENT_AI_CONFIG;
            res.json({ success: true, data: config });
        } else if (role === "vendor") {
            const config = data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG;
            res.json({ success: true, data: config });
        } else {
            res.json({
                success: true,
                data: {
                    client: data.client_ai_config || DEFAULT_CLIENT_AI_CONFIG,
                    vendor: data.vendor_ai_config || DEFAULT_VENDOR_AI_CONFIG,
                },
            });
        }
    } catch (error) {
        logStep("获取 AI 配置失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 更新 AI 参数配置
 * POST /api/config/ai
 */
function setAiConfig(req, res) {
    try {
        const data = db.read();
        const { role, config } = req.body || {};
        const { DEFAULT_CLIENT_AI_CONFIG, DEFAULT_VENDOR_AI_CONFIG } = db.constants;

        if (!role || !["client", "vendor"].includes(role)) {
            return res.status(400).json({
                success: false,
                error: "请指定 role 参数（client 或 vendor）",
            });
        }

        const configKey = role === "client" ? "client_ai_config" : "vendor_ai_config";
        const defaultConfig = role === "client" ? DEFAULT_CLIENT_AI_CONFIG : DEFAULT_VENDOR_AI_CONFIG;

        data[configKey] = db.mergeAiConfig(data[configKey], config, defaultConfig);

        db.write(data);
        logStep(`更新 ${role} AI 配置`, data[configKey]);
        res.json({ success: true, data: data[configKey] });
    } catch (error) {
        logStep("更新 AI 配置失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

/**
 * 批量更新 AI 配置
 * POST /api/config/ai/batch
 */
function batchSetAiConfig(req, res) {
    try {
        const data = db.read();
        const { client, vendor } = req.body || {};
        const { DEFAULT_CLIENT_AI_CONFIG, DEFAULT_VENDOR_AI_CONFIG } = db.constants;

        if (client) {
            data.client_ai_config = db.mergeAiConfig(data.client_ai_config, client, DEFAULT_CLIENT_AI_CONFIG);
        }
        if (vendor) {
            data.vendor_ai_config = db.mergeAiConfig(data.vendor_ai_config, vendor, DEFAULT_VENDOR_AI_CONFIG);
        }

        db.write(data);
        logStep("批量更新 AI 配置", { client: data.client_ai_config, vendor: data.vendor_ai_config });
        res.json({
            success: true,
            data: {
                client: data.client_ai_config,
                vendor: data.vendor_ai_config,
            },
        });
    } catch (error) {
        logStep("批量更新 AI 配置失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

// ============================================
// Persona 配置 API
// ============================================

/**
 * 更新 Persona 配置
 * POST /api/config/persona
 */
function setPersona(req, res) {
    try {
        const { client, vendor } = req.body || {};
        const data = db.read();
        const { DEFAULT_DB } = db.constants;

        data.personas = {
            client: client ? String(client) : data.personas?.client || DEFAULT_DB.personas.client,
            vendor: vendor ? String(vendor) : data.personas?.vendor || DEFAULT_DB.personas.vendor,
        };
        db.write(data);
        logStep("更新 persona 配置", data.personas);
        res.json({ success: true, data: data.personas });
    } catch (error) {
        logStep("更新 persona 失败", { error: String(error) });
        res.status(500).json({ success: false, error: String(error) });
    }
}

// ============================================
// 规则配置 API
// ============================================

/**
 * 获取乙方回复规则
 * GET /api/config/vendor-rules
 */
function getVendorRules(req, res) {
    const { AUTHOR_TYPES, VENDOR_REPLY_RULES } = db.constants;
    res.json({
        success: true,
        data: {
            ...VENDOR_REPLY_RULES,
            author_types: AUTHOR_TYPES,
        },
    });
}

// ============================================
// 导出
// ============================================

module.exports = {
    // 模型配置
    getModelConfig,
    setModelConfig,
    // AI 参数配置
    getAiConfig,
    setAiConfig,
    batchSetAiConfig,
    // Persona 配置
    setPersona,
    // 规则配置
    getVendorRules,
};
