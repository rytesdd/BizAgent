// 直接测试正则修复
const testStr = '{"type": "markdown", "content", "hello world"}';
console.log('Original:', testStr);

// 这个正则匹配 "任意文字", "
let fixed = testStr.replace(/"([^"]+)",\s*"/g, '"$1": "');
console.log('After fix:', fixed);

// 测试完整的修复函数
function fixCommonJsonErrors(str) {
    let fixed = str;

    // 修复1: "key", "value" 应该是 "key": "value"
    fixed = fixed.replace(/"([^"]+)",\s*"/g, '"$1": "');
    fixed = fixed.replace(/"([^"]+)",\s*\{/g, '"$1": {');
    fixed = fixed.replace(/"([^"]+)",\s*\[/g, '"$1": [');
    fixed = fixed.replace(/"([^"]+)",\s*(\d)/g, '"$1": $2');
    fixed = fixed.replace(/"([^"]+)",\s*(true|false|null)/g, '"$1": $2');

    // 修复2: 移除尾部多余逗号
    fixed = fixed.replace(/,\s*\]/g, ']');
    fixed = fixed.replace(/,\s*\}/g, '}');

    return fixed;
}

const badJson = '[{"type": "markdown", "content", "hello world"}]';
console.log('\n--- Full test ---');
console.log('Input:', badJson);
const fixedJson = fixCommonJsonErrors(badJson);
console.log('Fixed:', fixedJson);

try {
    const parsed = JSON.parse(fixedJson);
    console.log('Parse SUCCESS:', parsed);
} catch (e) {
    console.log('Parse FAILED:', e.message);
}
