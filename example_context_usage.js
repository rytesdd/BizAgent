/**
 * Example usage of the new Standard Context Interface for PRD generation
 * 
 * This file demonstrates how to use the refactored generatePRD and generatePRDStream
 * functions with both the legacy string format and the new structured context object.
 */

const aiService = require('./services/aiService');

// ============================================
// Example 1: Legacy Usage (Backward Compatible)
// ============================================

async function example1_legacyStringInput() {
    console.log('=== Example 1: Legacy String Input ===\n');

    // This still works - the string is automatically converted to { user_goal: "..." }
    const prd = await aiService.generatePRD(
        "创建一个支持微信登录的用户管理系统"
    );

    console.log('PRD generated successfully');
    console.log('Length:', prd.length);
    console.log('\n');
}

// ============================================
// Example 2: New Structured Context (Minimal)
// ============================================

async function example2_minimalContext() {
    console.log('=== Example 2: Minimal Structured Context ===\n');

    const context = {
        user_goal: "创建一个电商结账流程"
    };

    const prd = await aiService.generatePRD(context);

    console.log('PRD generated with minimal context');
    console.log('Length:', prd.length);
    console.log('\n');
}

// ============================================
// Example 3: Full Structured Context
// ============================================

async function example3_fullContext() {
    console.log('=== Example 3: Full Structured Context ===\n');

    const context = {
        user_goal: "开发一个智能客服聊天系统",

        context_summary: `
      基于团队讨论和用户调研，我们发现：
      - 用户希望24/7在线支持
      - 需要支持多语言（中文、英文）
      - 要能够处理常见问题自动回复
      - 复杂问题需要转接人工客服
    `,

        constraints: [
            "移动端优先设计",
            "响应时间 < 2秒",
            "支持微信小程序集成",
            "需要符合 GDPR 数据合规要求",
            "预算控制在 50万元以内"
        ],

        reference_materials: `
      【竞品分析摘要】
      - 智能客服A：回复准确率85%，但UI复杂
      - 智能客服B：UI友好，但不支持多语言
      - 智能客服C：功能完善，但价格昂贵
      
      【用户访谈发现】
      - 80%用户希望快速解决简单问题
      - 60%用户担心隐私泄露
      - 客服高峰期在晚上8-10点
    `
    };

    const prd = await aiService.generatePRD(context, "专业严谨的产品经理");

    console.log('PRD generated with full context');
    console.log('Length:', prd.length);
    console.log('First 200 chars:', prd.substring(0, 200));
    console.log('\n');
}

// ============================================
// Example 4: Streaming with Structured Context
// ============================================

async function example4_streamingWithContext() {
    console.log('=== Example 4: Streaming with Structured Context ===\n');

    const context = {
        user_goal: "设计一个在线教育平台的课程管理模块",
        constraints: [
            "支持视频上传（最大2GB）",
            "需要课程进度追踪",
            "支持在线考试功能"
        ]
    };

    console.log('Streaming PRD generation...\n');

    let fullContent = '';
    let chunkCount = 0;

    for await (const chunk of aiService.generatePRDStream(context)) {
        fullContent += chunk;
        chunkCount++;

        // Show progress every 10 chunks
        if (chunkCount % 10 === 0) {
            process.stdout.write('.');
        }
    }

    console.log('\n\nStreaming complete!');
    console.log('Total chunks received:', chunkCount);
    console.log('Total length:', fullContent.length);
    console.log('\n');
}

// ============================================
// Example 5: Using Context from File Upload
// ============================================

async function example5_withFileContent() {
    console.log('=== Example 5: Context from File Upload ===\n');

    // Simulating content extracted from a PDF/Word document
    const uploadedFileContent = `
    产品愿景文档
    
    我们计划开发一个智能任务管理工具，帮助团队提高协作效率。
    
    核心功能：
    1. 任务创建和分配
    2. 进度可视化看板
    3. 团队协作讨论
    4. 自动提醒和通知
    
    技术要求：
    - 需要支持 10000+ 并发用户
    - 数据需要实时同步
    - 支持移动端 APP
  `;

    const context = {
        user_goal: "根据产品愿景文档生成详细的 PRD",
        context_summary: "团队协作工具，重点是任务管理和可视化",
        constraints: [
            "高并发支持（10000+用户）",
            "实时数据同步",
            "跨平台（Web + Mobile）"
        ],
        reference_materials: uploadedFileContent
    };

    const prd = await aiService.generatePRD(context);

    console.log('PRD generated from uploaded file content');
    console.log('Length:', prd.length);
    console.log('\n');
}

// ============================================
// Run Examples
// ============================================

async function runAllExamples() {
    try {
        // Note: Uncomment the examples you want to run
        // These are commented out by default to avoid actual API calls

        // await example1_legacyStringInput();
        // await example2_minimalContext();
        // await example3_fullContext();
        // await example4_streamingWithContext();
        // await example5_withFileContent();

        console.log('✅ All examples completed successfully!');
        console.log('\nTo run these examples:');
        console.log('1. Ensure your AI service is configured (mock/ollama/kimi)');
        console.log('2. Uncomment the examples you want to test');
        console.log('3. Run: node example_context_usage.js');

    } catch (error) {
        console.error('❌ Error running examples:', error.message);
        console.error(error.stack);
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    runAllExamples();
}

// Export for use in other files
module.exports = {
    example1_legacyStringInput,
    example2_minimalContext,
    example3_fullContext,
    example4_streamingWithContext,
    example5_withFileContent
};
