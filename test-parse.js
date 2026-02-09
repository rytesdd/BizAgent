// 测试 parseWidgetResponse 函数
const { parseWidgetResponse } = require('./server/prompts/personaPrompts');

// 测试用例：AI 常见的错误格式
const testCases = [
    // 测试1：带有错误的逗号而非冒号
    {
        name: 'Missing colon in key-value',
        input: '[{"type": "markdown", "content", "hello world"}]'
    },
    // 测试2：前面有文字说明
    {
        name: 'Text before JSON',
        input: '以下是分析结果：\n\n```json\n[{"type": "markdown", "content": "test"}]\n```'
    },
    // 测试3：正常 JSON
    {
        name: 'Normal JSON',
        input: '[{"type": "markdown", "content": "hello"}, {"type": "snapshot", "data": {"label": "test", "value": "100"}}]'
    },
    // 测试4：尾部多余逗号
    {
        name: 'Trailing comma',
        input: '[{"type": "markdown", "content": "test"},]'
    }
];

console.log('=== parseWidgetResponse Test ===\n');

testCases.forEach(tc => {
    console.log(`Test: ${tc.name}`);
    console.log(`Input: ${tc.input.substring(0, 60)}...`);
    const result = parseWidgetResponse(tc.input);
    console.log(`Success: ${result.success}`);
    if (result.success) {
        console.log(`Widgets: ${result.widgets.length}`);
        result.widgets.forEach(w => console.log(`  - ${w.type}`));
    } else {
        console.log(`Error: ${result.error}`);
    }
    console.log('---\n');
});
