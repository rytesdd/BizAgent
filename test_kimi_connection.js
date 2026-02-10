const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 尝试加载 .env
const envPath = path.resolve(process.cwd(), '.env');
console.log('正在检查 .env 文件...');
console.log('路径:', envPath);

try {
    if (fs.existsSync(envPath)) {
        console.log('.env 文件存在');
        try {
            const stats = fs.statSync(envPath);
            console.log('.env 文件权限:', stats.mode);
            console.log('.env 文件大小:', stats.size);

            // 尝试读取内容
            const content = fs.readFileSync(envPath, 'utf8');
            console.log('.env 文件读取成功 (长度: ' + content.length + ')');

            // 手动解析及 process.env 检查
            const parsed = dotenv.parse(content);
            if (parsed.KIMI_API_KEY) {
                console.log('KIMI_API_KEY 在 .env 文件中: 存在');
                console.log('KIMI_API_KEY 长度:', parsed.KIMI_API_KEY.length);
            } else {
                console.log('KIMI_API_KEY 在 .env 文件中: 未找到');
            }
        } catch (readErr) {
            console.error('.env 读取失败:', readErr.message);
        }
    } else {
        console.log('.env 文件不存在');
    }
} catch (err) {
    console.error('文件系统检查错误:', err.message);
}

// 检查 process.env
dotenv.config();
console.log('process.env.KIMI_API_KEY:', process.env.KIMI_API_KEY ? '存在 (长度: ' + process.env.KIMI_API_KEY.length + ')' : '不存在');

// 简单测试 Kimi 接口 (如果 Key 存在)
if (process.env.KIMI_API_KEY) {
    console.log('\n正在测试 Kimi API 连通性...');
    const https = require('https');
    const data = JSON.stringify({
        model: "kimi-k2.5",
        messages: [{ role: "user", content: "Hello" }],
        stream: false
    });

    const options = {
        hostname: 'api.moonshot.cn',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.KIMI_API_KEY}`
        }
    };

    const req = https.request(options, (res) => {
        console.log(`状态码: ${res.statusCode}`);
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log('响应体:', body.substring(0, 200) + (body.length > 200 ? '...' : ''));
        });
    });

    req.on('error', (e) => {
        console.error('请求错误:', e.message);
    });

    req.write(data);
    req.end();
} else {
    console.log('\n跳过 API 测试 (无 Key)');
}
