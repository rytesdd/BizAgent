/**
 * Persona Prompts - 甲乙方人设提示词系统
 * 
 * 包含：
 * - NARRATIVE_INSTRUCTION: 叙事逻辑层，防止 AI "报菜名"
 * - VENDOR_PROMPT: 乙方销售顾问人设，输出富 UI 卡片
 * - CLIENT_PROMPT: 甲方审计监管人设，仅输出 Markdown
 */

// ============================================================================
// PART 1: 文本衔接与叙事逻辑层 (The Narrative Engine)
// 作用：专门优化卡片之间的过渡文本，防止 AI "报菜名"，让它像人一样说话。
// ============================================================================
const NARRATIVE_INSTRUCTION = `
**NARRATIVE FLOW GUIDELINES (CRITICAL):**
1.  **No "Data Dumping":** Do NOT just list widgets one after another. You are a consultant, not a database.
2.  **Connective Tissue:** You MUST insert a \`markdown\` text block between every widget to explain the logic.
3.  **Structure:**
    * **The Hook:** Start with a high-level summary (Markdown) -> Then show the Data (Snapshot).
    * **The Twist:** Introduce a conflict or urgent issue (Markdown) -> Then show the Risk (Alert).
    * **The Solution:** Propose a strategy regarding the stakeholder (Markdown) -> Then show the Person (Key Person).
    * **The Action:** Conclude with a clear next step (Markdown) -> Then show the Task (Todo).
4.  **Tone:** Use transitional phrases like "However...", "To address this...", "Based on the data above...".
`;

// ============================================================================
// PART 2: 乙方人设 (Vendor Persona - Sales Mode)
// 作用：销售/售前视角，拥有调用所有 "BI Card" 的权限。
// ============================================================================
const VENDOR_PROMPT = `
**ROLE:** You are an elite **Senior Sales Strategy Consultant** (Pre-sales Expert).
**GOAL:** Help the vendor team WIN the deal, optimize ROI, and influence key stakeholders.
**TONE:** Strategic, Encouraging, Insightful, and Action-oriented.

${NARRATIVE_INSTRUCTION}

**CRITICAL INSTRUCTION: STRUCTURAL OUTPUT**
You are NO LONGER required to output JSON objects for cards. The system will handle the UI.
Your job is to provide the **NARRATIVE CONTENT** for the 4 key sections of the report.

**YOU MUST OUTPUT 4 DISTINCT SECTIONS SEPARATED BY THE DELIMITER: \`<<<SPLIT>>>\`**

**SECTION GUIDE:**
1.  **Section 1 (Summary & Win Rate):** Analyze the 78% win rate. Why is it trending up? (followed by \`<<<SPLIT>>>\`)
2.  **Section 2 (Risk Analysis):** Analyze the Huawei Cloud POC risk. Why is it dangerous? (followed by \`<<<SPLIT>>>\`)
3.  **Section 3 (Stakeholder Strategy):** Analyze Zhang Zong (CTO). How to address his migration cost concerns? (followed by \`<<<SPLIT>>>\`)
4.  **Section 4 (Action Plan):** Conclude with urgency. Why must we book the meeting now?

**EXAMPLE OUTPUT:**
Based on the latest data, our win rate is solid at 78%... [Analysis] ...
<<<SPLIT>>>
However, a critical risk has emerged. Huawei Cloud just finished their POC... [Analysis] ...
<<<SPLIT>>>
To counter this, we need to focus on Zhang Zong. He is currently neutral... [Analysis] ...
<<<SPLIT>>>
Therefore, our immediate next step is to prepare the comparison matrix... [Analysis] ...

**DO NOT output JSON. DO NOT output "Card 1". Just output the 4 text sections separated by the delimiter.**
`;



// ============================================================================
// PART 3: 甲方人设 (Client Persona - Audit Mode)
// 作用：监管/审计视角。目前 *不使用* 乙方的 UI 卡片，避免误导。只输出高质量 Markdown。
// ============================================================================
const CLIENT_PROMPT = `
**ROLE:** You are a strict **Government Project Auditor** (PMO / Supervision Dept).
**GOAL:** Ensure Compliance, Budget Safety, and Delivery Quality. Minimize Risk.
**TONE:** Objective, Critical, Risk-Averse, Formal.

**OUTPUT RESTRICTIONS:**
1.  **NO VENDOR WIDGETS:** Do NOT use the Snapshot, KeyPerson, or FeatureList widgets designed for sales. They are not appropriate for an audit report.
2.  **MARKDOWN ONLY (For now):** Output your analysis strictly as structured **Markdown Text**.
    * Use tables, bullet points, and bold text to present your findings.
    * Focus on: "Compliance Risks", "Budget Variance", "Vendor Qualifications".

**OUTPUT SCHEMA (Client Mode):**
You must output a **JSON Array** containing only Markdown blocks:

1.  **Markdown Block**: For all audit content.
    * Schema: \`{"type": "markdown", "content": "Your audit analysis here..."}\`

**EXAMPLE OUTPUT (Client Mode):**
\`\`\`json
[
  {"type": "markdown", "content": "## 📋 项目审计报告\\n\\n### 1. 合规性检查\\n\\n| 检查项 | 状态 | 风险等级 |\\n|--------|------|----------|\\n| 资质审查 | ⚠️ 待确认 | 中 |\\n| 预算合规 | ✅ 合格 | 低 |\\n\\n### 2. 预算偏差分析\\n\\n**发现问题：** 乙方报价中存在以下疑点：\\n- 人天单价偏高（行业均价 ¥2,500/天，报价 ¥3,200/天）\\n- 测试周期压缩可能导致质量风险\\n\\n### 3. 建议措施\\n\\n1. **要求乙方提供详细的资质证明文件**\\n2. **组织价格核议会议**\\n3. **增加验收标准的明确性**"}
]
\`\`\`

**NARRATIVE APPROACH:**
When analyzing the project, focus on finding holes in the proposal:
- Question the "Win Rate" (interpret it as Risk for the Client)
- Question the "ROI" claims (interpret it as potential Budget Waste)
- Verify vendor qualifications and past performance
- Check for hidden costs and scope creep risks
`;

// ============================================================================
// PART 4: 工具函数 - 根据用户角色获取对应的提示词
// ============================================================================

/**
 * 支持的用户角色类型
 */
const PERSONA_TYPES = {
    VENDOR: 'vendor',   // 乙方 - 销售/售前
    CLIENT: 'client',   // 甲方 - 审计/监管
};

/**
 * 根据角色获取对应的人设提示词
 * @param {string} persona - 用户角色: 'vendor' | 'client'
 * @param {object} customConfig - 自定义人设配置 (可选) { role, goal, tone }
 * @returns {string} 对应的系统提示词
 */
function getPersonaPrompt(persona, customConfig = {}) {
    let basePrompt = '';

    switch (persona) {
        case PERSONA_TYPES.VENDOR:
            basePrompt = VENDOR_PROMPT;
            break;
        case PERSONA_TYPES.CLIENT:
            basePrompt = CLIENT_PROMPT;
            break;
        default:
            basePrompt = VENDOR_PROMPT;
    }

    // 如果有自定义配置，替换默认的 Role/Goal/Tone
    if (customConfig && (customConfig.role || customConfig.goal || customConfig.tone)) {
        // 使用正则替换或者简单的字符串拼接重组
        // 为了稳定性，这里采用 "重组头部 + 保留Schema" 的策略

        let newHeader = '';

        if (customConfig.role) newHeader += `**ROLE:** ${customConfig.role}\n`;
        if (customConfig.goal) newHeader += `**GOAL:** ${customConfig.goal}\n`;
        if (customConfig.tone) newHeader += `**TONE:** ${customConfig.tone}\n`;

        // 找到原始 Prompt 中 NARRATIVE_INSTRUCTION 或 OUTPUT SCHEMA 开始的位置
        // VENDOR: 原始头部 -> NARRATIVE_INSTRUCTION -> OUTPUT SCHEMA
        // CLIENT: 原始头部 -> OUTPUT RESTRICTIONS

        // 简单粗暴的方法：直接把头部替换掉？
        // 由于原始 Prompt 是通过模板字符串拼接的，很难精准替换。
        // 我们可以把 VENDOR_PROMPT 拆解，或者允许 customConfig 覆盖

        // 方案 B: 仅在 Prompt 顶部追加 "USER OVERRIDES" 指令，这通常对 LLM 很有效
        const overrideSection = `
**[SYSTEM OVERRIDE]**
The user has explicitly defined the persona settings for this session. You MUST Follow these overrides:
${customConfig.role ? `- **ROLE:** ${customConfig.role}` : ''}
${customConfig.goal ? `- **GOAL:** ${customConfig.goal}` : ''}
${customConfig.tone ? `- **TONE:** ${customConfig.tone}` : ''}
`;
        return basePrompt + overrideSection;
    }

    return basePrompt;
}

/**
 * 构建完整的系统提示词（结合项目上下文）
 * @param {string} persona - 用户角色
 * @param {object} projectContext - 项目上下文
 * @param {object} customConfig - 自定义人设配置
 * @returns {string} 完整的系统提示词
 */
function buildPersonaSystemPrompt(persona, projectContext = {}, customConfig = {}) {
    const basePrompt = getPersonaPrompt(persona, customConfig);


    const contextSection = `
**PROJECT CONTEXT:**
- 项目名称: ${projectContext.project_name || '未命名项目'}
- 当前阶段: ${projectContext.current_stage || '未知'}
- 项目进度: ${projectContext.progress || '未知'}
- 文档状态: ${projectContext.has_prd ? '已加载 PRD 文档' : '未加载文档'}
- 当前时间: ${new Date().toLocaleString('zh-CN')}
`;

    return `${basePrompt}\n${contextSection}`;
}

/**
 * UI Widget 类型枚举（用于前端渲染）
 */
const WIDGET_TYPES = {
    MARKDOWN: 'markdown',
    SNAPSHOT: 'snapshot',
    ALERT: 'alert',
    KEY_PERSON: 'key_person',
    FEATURE_LIST: 'feature_list',
    TODO: 'todo',
};

/**
 * 验证 Widget 数据结构是否合法
 * @param {object} widget - Widget 对象
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWidget(widget) {
    if (!widget || typeof widget !== 'object') {
        return { valid: false, error: 'Widget must be an object' };
    }

    if (!widget.type) {
        return { valid: false, error: 'Widget must have a type' };
    }

    const validTypes = Object.values(WIDGET_TYPES);
    if (!validTypes.includes(widget.type)) {
        return { valid: false, error: `Unknown widget type: ${widget.type}` };
    }

    // Markdown 类型需要 content 字段
    if (widget.type === WIDGET_TYPES.MARKDOWN && !widget.content) {
        return { valid: false, error: 'Markdown widget must have content' };
    }

    // 其他类型需要 data 字段
    if (widget.type !== WIDGET_TYPES.MARKDOWN && !widget.data) {
        return { valid: false, error: `${widget.type} widget must have data` };
    }

    return { valid: true };
}

// ============================================================================
// PART 5: 占位符替换 (Placeholder Replacement)
// ============================================================================

const FIXED_CARDS = {
    "CARD_1": { "type": "snapshot", "data": { "label": "预估赢率", "value": "78%", "trend": "up", "color": "purple" } },
    "CARD_2": { "type": "alert", "data": { "level": "danger", "title": "竞争对手动态", "description": "华为云团队已完成 POC，本周五将进行最终汇报" } },
    "CARD_3": { "type": "key_person", "data": { "name": "张总", "role": "CTO", "stance": "neutral", "pain_point": "担心迁移成本", "strategy": "强调平滑迁移方案" } },
    "CARD_4": { "type": "todo", "data": { "priority": "P0", "task": "准备竞争对比材料并预约张总会议", "owner": "销售经理", "deadline": "本周三前" } }
};

/**
 * 解析 AI 响应为 Widget 数组
 * 增强版：支持多种 JSON 格式 + 自动替换 Placeholder
 * @param {string} response - AI 原始响应
 * @returns {{ success: boolean, widgets?: Array, error?: string }}
 */
/**
 * 解析 AI 响应为 Widget 数组
 * 方案 A (增强版): 后端强制注入卡片，不再依赖 AI 输出 JSON 占位符
 * 
 * @param {string} response - AI 原始响应
 * @param {string} persona - 当前角色 ('vendor' | 'client')
 * @returns {{ success: boolean, widgets?: Array, error?: string }}
 */
function parseWidgetResponse(response, persona = 'client') {
    if (!response || typeof response !== 'string') {
        return { success: false, error: 'Response is empty or not a string' };
    }

    // ========================================================================
    // LOGIC PATH 1: VENDOR (FORCE INJECTION)
    // ========================================================================
    if (persona === PERSONA_TYPES.VENDOR) {
        console.log('[parseWidgetResponse] Processing VENDOR response with Force Injection...');

        // 尝试使用分隔符切割文本
        const delimiter = '<<<SPLIT>>>';
        // Remove markdown artifacts if present
        let cleanResponse = response.replace(/^```json/i, '').replace(/^```markdown/i, '').replace(/```$/g, '');

        // Split and trim
        let parts = cleanResponse.split(delimiter).map(p => p.trim()).filter(p => p);

        // Fallback: If AI fails to split, try double newline or just use whole text
        if (parts.length < 2 && response.includes('\n\n')) {
            // Optional: heuristic split? No, risk of breaking sentences.
            // Just treat as one big block.
            console.warn(`[parseWidgetResponse] Delimiter not found. Using whole text as Section 1.`);
        }

        const widgets = [];

        // 强行按顺序拼接
        // 逻辑：Text1 -> Card1 -> Text2 -> Card2 -> Text3 -> Card3 -> Text4 -> Card4
        // 如果文本段落不够，后续文本为空，但卡片依然要显示！

        const getText = (idx) => parts[idx] || "";

        // Section 1
        if (getText(0)) widgets.push({ type: 'markdown', content: getText(0) });
        widgets.push(FIXED_CARDS.CARD_1);

        // Section 2
        if (getText(1)) widgets.push({ type: 'markdown', content: getText(1) });
        widgets.push(FIXED_CARDS.CARD_2);

        // Section 3
        if (getText(2)) widgets.push({ type: 'markdown', content: getText(2) });
        widgets.push(FIXED_CARDS.CARD_3);

        // Section 4
        if (getText(3)) widgets.push({ type: 'markdown', content: getText(3) });
        widgets.push(FIXED_CARDS.CARD_4);

        // Extra text?
        if (parts.length > 4) {
            widgets.push({ type: 'markdown', content: parts.slice(4).join('\n\n') });
        }

        console.log(`[parseWidgetResponse] VENDOR Success. Injected 4 cards.`);
        return { success: true, widgets };
    }

    // ========================================================================
    // LOGIC PATH 2: CLIENT / OTHER (LEGACY JSON PARSING)
    // ========================================================================
    console.log('[parseWidgetResponse] Processing STANDARD response (Client/Legacy)...');

    // 预处理：修复 AI 常见的 JSON 错误
    // AI 有时会把 "key": "value" 写成 "key", "value"（冒号写成逗号）
    // 我们需要修复所有可能的字段名
    const fieldsToFix = [
        'content', 'message', 'title', 'name', 'value', 'label',
        'task', 'owner', 'deadline', 'role', 'stance', 'pain_point',
        'strategy', 'status', 'match_score', 'trend', 'color',
        'level', 'source', 'time', 'priority', 'influence',
        'core_features', 'data', 'type', 'id', 'description'
    ];

    let preprocessed = response;
    for (const field of fieldsToFix) {
        // 修复 "field", "xxx" -> "field": "xxx"
        const regex1 = new RegExp(`"${field}",\\s*"`, 'g');
        preprocessed = preprocessed.replace(regex1, `"${field}": "`);

        // 修复 "field", { -> "field": {
        const regex2 = new RegExp(`"${field}",\\s*\\{`, 'g');
        preprocessed = preprocessed.replace(regex2, `"${field}": {`);

        // 修复 "field", [ -> "field": [
        const regex3 = new RegExp(`"${field}",\\s*\\[`, 'g');
        preprocessed = preprocessed.replace(regex3, `"${field}": [`);

        // 修复 "field", 数字 -> "field": 数字
        const regex4 = new RegExp(`"${field}",\\s*(\\d)`, 'g');
        preprocessed = preprocessed.replace(regex4, `"${field}": $1`);

        // 修复 "field", true/false/null -> "field": true/false/null
        const regex5 = new RegExp(`"${field}",\\s*(true|false|null)`, 'g');
        preprocessed = preprocessed.replace(regex5, `"${field}": $1`);
    }

    // 移除尾部多余逗号（这个是安全的）
    preprocessed = preprocessed.replace(/,\s*\]/g, ']');
    preprocessed = preprocessed.replace(/,\s*\}/g, '}');

    // 多种清理策略
    const cleanStrategies = [
        // 策略1: 直接尝试（response 本身就是纯 JSON）
        (r) => r.trim(),
        // 策略2: 移除 markdown 代码块标记
        (r) => r.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(),
        // 策略3: 提取第一个 JSON 数组（贪婪匹配）
        (r) => {
            const match = r.match(/\[[\s\S]*\]/);
            return match ? match[0] : null;
        },
        // 策略4: 提取最后一个完整的 JSON 数组（有时 AI 会在前面加解释文字）
        (r) => {
            const matches = r.match(/\[[\s\S]*?\]/g);
            if (matches && matches.length > 0) {
                // 找最长的那个（通常是完整的）
                return matches.reduce((a, b) => a.length > b.length ? a : b);
            }
            return null;
        },
        // 策略5: 移除所有非 JSON 字符前缀后缀
        (r) => {
            const start = r.indexOf('[');
            const end = r.lastIndexOf(']');
            if (start !== -1 && end !== -1 && end > start) {
                return r.substring(start, end + 1);
            }
            return null;
        },
        // 策略6: 暴力修复未转义的换行符 (Common AI Error in Markdown content)
        (r) => {
            // 1. 先尝试提取 JSON 数组
            const match = r.match(/\[[\s\S]*\]/);
            let target = match ? match[0] : r;

            // 2. 将值当中的实际换行符替换为 \\n
            // 这是一个比较激进的正则，它尝试匹配 "key": "value... \n ..." 结构中的换行
            // 但为了安全起见，我们主要针对 markdown content 字段进行处理
            // 这里的简单替换：将非开头结尾的 \n 替换为 \\n 可能会误伤，所以我们采用更安全的做法：
            // 使用 JSON5 类似的宽容解析库思路（这里手写一个简化的）
            // 或者直接替换所有 visible newline characters inside quotes? Complex.

            // 简单有效方案：将所有实际换行符替换为 \\n，但要避开 JSON 结构本身的换行
            // 遗憾的是正则很难完美做到。
            // 替代方案：让 AI "重试" 或者在 prompt 里强调 (已做)。

            // 这里我们尝试由于 AI 经常在 "content": "..." 中直接换行
            // 我们尝试将 "content": "..." 内部的换行符转义
            return target.replace(/("content"\s*:\s*")([^"]*)(")/g, (match, p1, p2, p3) => {
                return p1 + p2.replace(/\n/g, '\\n').replace(/\r/g, '') + p3;
            });
        }
    ];

    let lastError = '';

    for (const strategy of cleanStrategies) {
        try {
            const cleaned = strategy(preprocessed);
            if (!cleaned) continue;

            const parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed)) {
                lastError = 'Parsed result is not an array';
                continue;
            }

            // 1. Filter out garbage (Validating structure)
            const validWidgets = parsed.filter(widget => {
                if (!widget || typeof widget !== 'object') return false;
                if (!widget.type) return false;

                // Allow markdown (must have content)
                if (widget.type === 'markdown') return !!widget.content;

                // Allow placeholder (must have id)
                if (widget.type === 'placeholder') return !!widget.id;

                // Other types (must have data)
                return !!widget.data;
            });

            if (validWidgets.length === 0) {
                lastError = 'No valid widgets found after filtering';
                continue;
            }

            // 成功！返回过滤后的有效 widgets

            // [NEW] Replace Placeholders with Real Cards
            const enrichedWidgets = validWidgets.map(widget => {
                if (widget.type === 'placeholder' && widget.id) {
                    // Normalize ID: trim whitespace and uppercase
                    const cardId = String(widget.id).trim().toUpperCase();

                    if (FIXED_CARDS[cardId]) {
                        console.log(`[parseWidgetResponse] Replacing placeholder ${widget.id} -> ${cardId} with real card.`);
                        return FIXED_CARDS[cardId];
                    } else {
                        console.warn(`[parseWidgetResponse] Placeholder ID not found in FIXED_CARDS: ${widget.id} (normalized: ${cardId})`);
                        return {
                            type: 'alert',
                            data: {
                                level: 'warning',
                                title: 'Card Load Error',
                                description: `Could not load card: ${widget.id}`
                            }
                        };
                    }
                }
                return widget;
            });

            console.log(`[parseWidgetResponse] Success with strategy, found ${enrichedWidgets.length} widgets (after substitution)`);
            return { success: true, widgets: enrichedWidgets };

        } catch (e) {
            lastError = e.message;
            continue; // 尝试下一个策略
        }
    }

    // 所有策略都失败了 -> 终极兜底 (Last Resort Fallback)
    // 绝对不返回 raw JSON string，而是尝试提取其中的文本内容构建一个简单的 Markdown Widget
    console.warn(`[parseWidgetResponse] All strategies failed. Applying Fallback. Error: ${lastError}`);

    // 尝试提取所有 markdown content 的内容
    // 正则匹配 "content": "..."
    const contentMatches = [];
    const contentRegex = /"content"\s*:\s*"([^"]*)"/g;
    let match;
    while ((match = contentRegex.exec(response)) !== null) {
        if (match[1]) {
            // Unescape newline chars back to real newlines for display
            contentMatches.push(match[1].replace(/\\n/g, '\n'));
        }
    }

    if (contentMatches.length > 0) {
        return {
            success: true,
            widgets: [
                {
                    type: 'markdown',
                    content: contentMatches.join('\n\n---\n\n') + "\n\n*(系统注：部分组件渲染失败，已降级为纯文本显示)*"
                }
            ]
        };
    }

    // 如果连 content 都提取不到，直接把整个 response 作为纯文本返回（去掉 JSON 括号以免看起来像乱码）
    // 移除 [ { } ] 等 JSON 符号，尽量只保留文本
    const cleanText = response
        .replace(/[\[\]\{\}"]/g, '') // Remove JSON syntax chars
        .replace(/type\s*:\s*markdown/g, '')
        .replace(/content\s*:/g, '')
        .replace(/,\s*$/gm, '') // Remove trailing commas
        .trim();

    return {
        success: true,
        widgets: [
            {
                type: 'markdown',
                content: cleanText || "系统繁忙，无法生成结构化报告。"
            }
        ]
    };
}


// ============================================================================
// 导出
// ============================================================================

module.exports = {
    // 原始提示词
    NARRATIVE_INSTRUCTION,
    VENDOR_PROMPT,
    CLIENT_PROMPT,

    // 类型枚举
    PERSONA_TYPES,
    WIDGET_TYPES,

    // 工具函数
    getPersonaPrompt,
    buildPersonaSystemPrompt,
    validateWidget,
    parseWidgetResponse,
};
