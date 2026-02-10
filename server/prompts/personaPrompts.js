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
5.  **Language (CRITICAL):** ALL output MUST be in Chinese. Every sentence, card data value, and analysis paragraph must be in Chinese. No English allowed.
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

**PRIORITY REMINDER:** The NARRATIVE_INSTRUCTION above (Hook, Twist, Solution, Action) is the MOST IMPORTANT part of your output. Your text must be detailed, consultative, and flow naturally like a seasoned advisor speaking to a sales team.

**CRITICAL INSTRUCTION: STRUCTURAL OUTPUT**
Your job is to provide **NARRATIVE TEXT** + **CARD DATA** for 4 sections.

**YOU MUST OUTPUT 4 DISTINCT SECTIONS SEPARATED BY THE DELIMITER: \`<<<SPLIT>>>\`**

**DEPTH RULE (CRITICAL):**
Do NOT be brief. Each section must contain rich, consultative analysis. Expand on the "Why" and "How". Use transitional phrases, provide reasoning, cite data points, and explain implications. Think like a consultant presenting to a VP — not a chatbot giving bullet points.

**TEXT PURITY RULE (CRITICAL):**
Your narrative text must be PURE PROSE — flowing paragraphs only.
Do NOT output any Markdown tables (\`| ... | ... |\`), bullet-point lists of data, or structured field-value summaries in the narrative.
The system will display all structured data as cards automatically. You just write the story.

**CARD DATA FORMAT:**
At the END of each section (after your narrative text), you MUST append a card data block.
The format is:
\`\`\`
<<<CARD_DATA>>>
field1=value1
field2=value2
<<<END_CARD>>>
\`\`\`

**SECTION GUIDE (4 sections, each with narrative + card data):**

1.  **Section 1 (The Hook):** Write a detailed analysis of the win rate trend.
    Card fields: \`label\` (metric name), \`value\` (percentage), \`trend\` (up/down/flat)
    Example card block:
    <<<CARD_DATA>>>
    label=项目赢率
    value=78%
    trend=up
    <<<END_CARD>>>
    (followed by \`<<<SPLIT>>>\`)

2.  **Section 2 (The Twist):** Write a thorough explanation of the competitive threat.
    Card fields: \`title\` (risk title), \`description\` (risk summary in one sentence)
    Example card block:
    <<<CARD_DATA>>>
    title=竞争对手动态
    description=华为云团队已完成 POC，本周五将进行最终汇报
    <<<END_CARD>>>
    (followed by \`<<<SPLIT>>>\`)

3.  **Section 3 (The Solution):** Deep dive into the key stakeholder's concerns.
    Card fields: \`name\`, \`role\`, \`stance\` (supportive/neutral/against), \`pain_point\`, \`strategy\`
    Example card block:
    <<<CARD_DATA>>>
    name=张总
    role=CTO
    stance=neutral
    pain_point=担心迁移成本
    strategy=强调平滑迁移方案与长期ROI
    <<<END_CARD>>>
    (followed by \`<<<SPLIT>>>\`)

4.  **Section 4 (The Action):** Conclude with an urgent call to action.
    Card fields: \`priority\` (P0/P1/P2), \`task\` (action item), \`owner\` (responsible person), \`deadline\`
    Example card block:
    <<<CARD_DATA>>>
    priority=P0
    task=准备竞争对比材料并预约张总会议
    owner=销售经理
    deadline=本周三前
    <<<END_CARD>>>

**FINAL REMINDERS:**
- DO NOT output any titles, headers, or Markdown tables in the narrative text.
- DO NOT output JSON.
- Each section = narrative prose + \`<<<CARD_DATA>>>\` block + \`<<<SPLIT>>>\` delimiter.
- The system adds section titles and renders cards automatically.
- **ALL text content MUST be in Chinese, including narrative text AND card data values. No English.**
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

**LANGUAGE RULE (CRITICAL):** ALL output MUST be in Chinese, including audit reports, tables, and recommendations. No English allowed.
`;

// ============================================================================
// PART 3.5: 意图专用提示词 (Intent-Specific Prompts for Vendor)
// ============================================================================

const VENDOR_SINGLE_INTENT_BASE = `
**LANGUAGE RULE (CRITICAL):** ALL output MUST be in Chinese. No English allowed.

**TEXT PURITY RULE:**
Your narrative text must be PURE PROSE. Do NOT output Markdown tables, bullet-point lists of data, or structured field-value summaries.
The system will display all structured data as cards automatically. You just write the story.

**DEPTH RULE:**
Do NOT be brief. Your analysis must contain rich, consultative content. Expand on the "Why" and "How".
Use transitional phrases, provide reasoning, cite data points, and explain implications.
Think like a consultant presenting to a VP.

**OUTPUT FORMAT:**
Write a detailed analysis narrative (at least 3 paragraphs), then append ONE card data block at the very end.
Do NOT output JSON. Do NOT output titles/headers. Do NOT use <<<SPLIT>>> delimiter. Output only one narrative + one card.
`;

const VENDOR_INTENT_PROMPTS = {
    win_rate: VENDOR_SINGLE_INTENT_BASE + `
**ROLE:** Senior Sales Strategy Consultant
**TASK:** Deeply analyze this project's win rate and ROI. Include: current win rate assessment, key influencing factors, comparison with historical projects, ROI forecast and basis.

**Card data format (append at end of narrative):**
<<<CARD_DATA>>>
label=metric name (e.g. "project win rate" in Chinese)
value=percentage (e.g. "78%")
trend=up or down or flat
<<<END_CARD>>>
`,

    risk: VENDOR_SINGLE_INTENT_BASE + `
**ROLE:** Risk Analysis Expert
**TASK:** Analyze the most urgent risks and competitive threats facing this project. Include: source and nature of risk, potential impact, competitor dynamics, time urgency assessment.

**Card data format (append at end of narrative):**
<<<CARD_DATA>>>
title=risk title (concise, in Chinese)
description=one-sentence risk description (in Chinese, max 50 chars)
<<<END_CARD>>>
`,

    key_person: VENDOR_SINGLE_INTENT_BASE + `
**ROLE:** Client Relationship Strategy Consultant
**TASK:** Analyze the key decision-maker of this project. Include: their position in the decision chain, influence level, current stance assessment, core concerns/pain points, targeted strategy recommendations.

**Card data format (append at end of narrative):**
<<<CARD_DATA>>>
name=person name (in Chinese)
role=job title (in Chinese)
stance=supportive or neutral or against
pain_point=core concern (one sentence in Chinese)
strategy=counter strategy (one sentence in Chinese)
<<<END_CARD>>>
`,
};

const INTENT_CARD_CONFIG = {
    win_rate: { templateIndex: 0, header: '### \ud83d\udcca \u8d62\u7387\u5206\u6790' },
    risk: { templateIndex: 1, header: '### \u26a0\ufe0f \u7ade\u4e89\u98ce\u9669' },
    key_person: { templateIndex: 2, header: '### \ud83c\udfaf \u5173\u952e\u4eba\u7269\u7b56\u7565' },
};

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
function buildPersonaSystemPrompt(persona, projectContext = {}, customConfig = {}, intent = null) {
    let basePrompt;
    if (persona === PERSONA_TYPES.VENDOR && intent && intent !== 'full' && VENDOR_INTENT_PROMPTS[intent]) {
        basePrompt = VENDOR_INTENT_PROMPTS[intent];
        if (customConfig && (customConfig.role || customConfig.goal || customConfig.tone)) {
            basePrompt += `\n**[USER OVERRIDE]**\n${customConfig.role ? `- **ROLE:** ${customConfig.role}` : ''}\n${customConfig.goal ? `- **GOAL:** ${customConfig.goal}` : ''}\n${customConfig.tone ? `- **TONE:** ${customConfig.tone}` : ''}\n`;
        }
    } else {
        basePrompt = getPersonaPrompt(persona, customConfig);
    }

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
    GATEWAY: 'gateway',
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
// PART 5: 卡片模板系统 (Card Template System)
// 字段标题（type + field names）锁死，字段值由 AI 填写，兜底用默认值
// ============================================================================

/**
 * FIXED_CARDS: 保留用于 CLIENT 路径的兜底和 placeholder 替换
 */
const FIXED_CARDS = {
    "CARD_1": { "type": "snapshot", "data": { "label": "预估赢率", "value": "78%", "trend": "up", "color": "purple" } },
    "CARD_2": { "type": "alert", "data": { "level": "danger", "title": "竞争对手动态", "description": "华为云团队已完成 POC，本周五将进行最终汇报" } },
    "CARD_3": { "type": "key_person", "data": { "name": "张总", "role": "CTO", "stance": "neutral", "pain_point": "担心迁移成本", "strategy": "强调平滑迁移方案" } },
    "CARD_4": { "type": "todo", "data": { "priority": "P0", "task": "准备竞争对比材料并预约张总会议", "owner": "销售经理", "deadline": "本周三前" } }
};

/**
 * CARD_TEMPLATES: 卡片模板，字段标题锁死，值为默认兜底
 * - type: 卡片类型（snapshot / alert / key_person / todo）
 * - fields: 允许 AI 填写的字段名列表
 * - defaults: 默认值（AI 未提供时使用）
 */
const CARD_TEMPLATES = [
    {
        type: 'snapshot',
        fields: ['label', 'value', 'trend', 'color'],
        defaults: { label: '预估赢率', value: '78%', trend: 'up', color: 'purple' }
    },
    {
        type: 'alert',
        fields: ['level', 'title', 'description'],
        defaults: { level: 'danger', title: '竞争对手动态', description: '华为云团队已完成 POC，本周五将进行最终汇报' }
    },
    {
        type: 'key_person',
        fields: ['name', 'role', 'stance', 'pain_point', 'strategy'],
        defaults: { name: '张总', role: 'CTO', stance: 'neutral', pain_point: '担心迁移成本', strategy: '强调平滑迁移方案' }
    },
    {
        type: 'todo',
        fields: ['priority', 'task', 'owner', 'deadline'],
        defaults: { priority: 'P0', task: '准备竞争对比材料并预约张总会议', owner: '销售经理', deadline: '本周三前' }
    }
];

/**
 * 从文本中提取 <<<CARD_DATA>>>...<<<END_CARD>>> 块
 * @param {string} text - 单段 AI 输出文本
 * @returns {{ narrative: string, cardData: object|null }}
 */
function extractCardData(text) {
    const cardDataRegex = /<<<CARD_DATA>>>[\s\S]*?<<<END_CARD>>>/;
    const match = text.match(cardDataRegex);

    if (!match) {
        return { narrative: text, cardData: null };
    }

    // 去掉标记块，保留纯叙事文本
    const narrative = text.replace(cardDataRegex, '').trim();

    // 解析 key=value 对
    const dataBlock = match[0]
        .replace('<<<CARD_DATA>>>', '')
        .replace('<<<END_CARD>>>', '')
        .trim();

    const cardData = {};
    dataBlock.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const value = trimmed.substring(eqIdx + 1).trim();
            if (key && value) cardData[key] = value;
        }
    });

    return { narrative, cardData: Object.keys(cardData).length > 0 ? cardData : null };
}

/**
 * 清洗叙事文本：去掉 AI 可能泄漏的结构化内容
 * @param {string} text - 原始叙事文本
 * @returns {string} 清洗后的纯文本
 */
function cleanNarrativeText(text) {
    return text
        // 去掉 Markdown 标题行
        .replace(/^#{1,4}\s+.+$/gm, '')
        // 去掉 Markdown 表格行（| xxx | xxx |）
        .replace(/^\|.*\|\s*$/gm, '')
        // 去掉 AI 自创的英文卡片小标题
        .replace(/^(Win Rate Snapshot|Risk Alert|Key Person Profile|Action Plan|Stakeholder Profile)\s*$/gim, '')
        // 去掉连续空行（合并为最多一个空行）
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

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
function parseWidgetResponse(response, persona = 'client', intent = 'full') {
    if (!response || typeof response !== 'string') {
        return { success: false, error: 'Response is empty or not a string' };
    }

    // ========================================================================
    // LOGIC PATH 0: VENDOR SINGLE INTENT
    // ========================================================================
    if (persona === PERSONA_TYPES.VENDOR && intent && intent !== 'full' && INTENT_CARD_CONFIG[intent]) {
        console.log(`[parseWidgetResponse] Processing VENDOR single intent: ${intent}`);

        let cleanResponse = response.replace(/^```json/i, '').replace(/^```markdown/i, '').replace(/```$/g, '');

        const config = INTENT_CARD_CONFIG[intent];
        const template = CARD_TEMPLATES[config.templateIndex];

        const { narrative, cardData } = extractCardData(cleanResponse);
        const cleanText = cleanNarrativeText(narrative);

        const widgets = [];
        const contentWithHeader = `${config.header}\n\n${cleanText}`;
        widgets.push({ type: 'markdown', content: cleanText ? contentWithHeader : config.header });

        const mergedData = { ...template.defaults };
        if (cardData) {
            for (const [key, value] of Object.entries(cardData)) {
                if (template.fields.includes(key)) {
                    mergedData[key] = value;
                    console.log(`[parseWidgetResponse] Single intent: AI filled "${key}" = "${value}"`);
                }
            }
        }
        widgets.push({ type: template.type, data: mergedData });

        // 注入 Gateway 卡片 —— 点击后前端展开文档区域
        widgets.push({
            type: 'gateway',
            data: {
                id: 'prd-document',
                icon: 'document',
                title: '查看 PRD 文档',
                summary: '点击查看完整项目文档，对照分析结果',
                tag: '文档'
            }
        });

        console.log(`[parseWidgetResponse] Single intent ${intent} done (with gateway).`);
        return { success: true, widgets };
    }

    // ========================================================================
    // LOGIC PATH 1: VENDOR FULL ANALYSIS (FORCE INJECTION)
    // ========================================================================
    if (persona === PERSONA_TYPES.VENDOR) {
        console.log('[parseWidgetResponse] Processing VENDOR response with Force Injection...');

        // Remove markdown artifacts if present
        let cleanResponse = response.replace(/^```json/i, '').replace(/^```markdown/i, '').replace(/```$/g, '');

        // ============================================================
        // 多级分割策略：确保 AI 不管用什么格式，都能切成 4 段
        // ============================================================
        let parts = [];

        // 策略 1: 用 <<<SPLIT>>> 分隔符（首选）
        const delimiter = '<<<SPLIT>>>';
        if (cleanResponse.includes(delimiter)) {
            parts = cleanResponse.split(delimiter).map(p => p.trim()).filter(p => p);
            console.log(`[parseWidgetResponse] Split strategy: <<<SPLIT>>> → ${parts.length} parts`);
        }

        // 策略 2: 用 <<<CARD_DATA>>> 块作为锚点分割
        // 逻辑：每个 CARD_DATA 块标记一个 section 的结尾
        // 文本结构: [text1]<<<CARD_DATA>>>...<<<END_CARD>>>[text2]<<<CARD_DATA>>>...
        if (parts.length < 2) {
            const cardBlockRegex = /<<<CARD_DATA>>>[\s\S]*?<<<END_CARD>>>/g;
            const cardBlocks = cleanResponse.match(cardBlockRegex);
            if (cardBlocks && cardBlocks.length >= 2) {
                // 用 CARD_DATA 块作为分割点，保留块在对应段内
                // 先把每个 CARD_DATA 块替换为一个唯一分隔符
                const tempDelimiter = '<<<__SECTION_BREAK__>>>';
                let marked = cleanResponse;
                cardBlocks.forEach(block => {
                    // 在每个 CARD_DATA 块后面插入分隔符
                    marked = marked.replace(block, block + tempDelimiter);
                });
                // 最后一个 section 末尾不需要分隔符，去掉末尾的
                if (marked.endsWith(tempDelimiter)) {
                    marked = marked.slice(0, -tempDelimiter.length);
                }
                parts = marked.split(tempDelimiter).map(p => p.trim()).filter(p => p);
                console.log(`[parseWidgetResponse] Split strategy: <<<CARD_DATA>>> anchors → ${parts.length} parts`);
            }
        }

        // 策略 3: 用数字编号模式分割（AI 爱用 "1." "2." 或 "一、" "二、"）
        if (parts.length < 2) {
            // 匹配行首的数字编号: "1." "2." "3." "4." 或 "一、" "二、" "三、" "四、"
            const numberedSplit = cleanResponse.split(/\n(?=(?:\d+[\.\、]|[一二三四][\、]))\s*/);
            if (numberedSplit.length >= 4) {
                parts = numberedSplit.map(p => p.trim()).filter(p => p);
                console.log(`[parseWidgetResponse] Split strategy: numbered sections → ${parts.length} parts`);
            }
        }

        // 策略 4: 兜底 —— 按段落均分
        if (parts.length < 2) {
            console.warn(`[parseWidgetResponse] All split strategies failed. Splitting by paragraphs.`);
            const paragraphs = cleanResponse.split(/\n\n+/).filter(p => p.trim());
            if (paragraphs.length >= 4) {
                // 尽量均分成 4 组
                const chunkSize = Math.ceil(paragraphs.length / 4);
                parts = [];
                for (let i = 0; i < 4; i++) {
                    const chunk = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize);
                    parts.push(chunk.join('\n\n'));
                }
            } else {
                // 段落太少，按原样处理（至少保证有内容）
                parts = paragraphs.length > 0 ? paragraphs : [cleanResponse];
            }
            console.log(`[parseWidgetResponse] Split strategy: paragraph chunking → ${parts.length} parts`);
        }

        // 确保至少有 4 段（不够的用空字符串补齐）
        while (parts.length < 4) {
            parts.push('');
        }

        const widgets = [];

        // 标题由代码注入，不依赖 AI
        const SECTION_HEADERS = [
            '### 📊 赢率分析',
            '### ⚠️ 竞争风险',
            '### 🎯 关键人物策略',
            '### ✅ 行动计划',
        ];

        const getText = (idx) => parts[idx] || '';

        for (let i = 0; i < 4; i++) {
            const rawText = getText(i);

            // Step 1: 提取 <<<CARD_DATA>>> 块
            const { narrative, cardData } = extractCardData(rawText);

            // Step 2: 清洗叙事文本（去掉泄漏的表格/标题等）
            const cleanText = cleanNarrativeText(narrative);

            // Step 3: 注入标题 + 纯叙事文本 → markdown widget
            const contentWithHeader = `${SECTION_HEADERS[i]}\n\n${cleanText}`;
            widgets.push({ type: 'markdown', content: cleanText ? contentWithHeader : SECTION_HEADERS[i] });

            // Step 4: 构建卡片 —— AI 提供的值 merge 进模板，缺失字段用默认值兜底
            const template = CARD_TEMPLATES[i];
            const mergedData = { ...template.defaults };
            if (cardData) {
                for (const [key, value] of Object.entries(cardData)) {
                    if (template.fields.includes(key)) {
                        mergedData[key] = value;
                        console.log(`[parseWidgetResponse] Card ${i + 1}: AI filled field "${key}" = "${value}"`);
                    }
                }
            } else {
                console.warn(`[parseWidgetResponse] Card ${i + 1}: No CARD_DATA found, using all defaults.`);
            }
            widgets.push({ type: template.type, data: mergedData });
        }

        // Extra text?
        if (parts.length > 4) {
            widgets.push({ type: 'markdown', content: parts.slice(4).join('\n\n') });
        }

        // 注入 Gateway 卡片 —— 点击后前端展开文档区域
        widgets.push({
            type: 'gateway',
            data: {
                id: 'prd-document',
                icon: 'document',
                title: '查看 PRD 文档',
                summary: '点击查看完整项目文档，包含需求详情与计费方案原型',
                tag: '文档'
            }
        });

        console.log(`[parseWidgetResponse] VENDOR Success. Processed 4 sections with template cards + gateway.`);
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
