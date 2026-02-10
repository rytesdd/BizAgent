import React, { useState, useEffect, useRef } from 'react';

/**
 * 原型生成与预览组件
 * 
 * 功能：
 * 1. 触发 AI 生成 PRD 原型 (Stream/SSE)
 * 2. 实时展示生成的 HTML 代码渲染结果
 * 3. 错误处理与重试
 */
const PrototypePreview = ({ prdText, onClose }) => {
    const [status, setStatus] = useState('idle'); // idle, generating, done, error
    const [htmlContent, setHtmlContent] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const iframeRef = useRef(null);

    const startGeneration = useCallback(async () => {
        setStatus('generating');
        setHtmlContent('');
        setErrorMsg('');

        try {
            // 使用 fetch API 处理 SSE
            const response = await fetch('/api/prototype/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prd_text: prdText }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || '生成请求失败');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedHtml = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const line = part.trim();
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'delta') {
                                accumulatedHtml += data.content;
                                // 实时更新 HTML (为了性能，可以考虑节流，这里简单起见直接更)
                                setHtmlContent(prev => prev + data.content);
                            } else if (data.type === 'done') {
                                setStatus('done');
                                setFileUrl(data.url);
                                // 最终完整更新一次，确保无遗漏
                                setHtmlContent(data.fullHtml);
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            if (e.message && !e.message.includes('JSON')) {
                                throw e;
                            }
                            console.warn('[Prototype] SSE parse error:', e);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Prototype] Generation failed:', err);
            setStatus('error');
            setErrorMsg(err.message);
        }
    }, [prdText]);

    // 自动开始生成
    useEffect(() => {
        if (prdText) {
            startGeneration();
        }
    }, [startGeneration]); // startGeneration depends on prdText

    // 更新 iframe 内容
    const htmlContentRef = useRef('');
    const rafIdRef = useRef(null);

    // 更新 iframe 内容 (Throttled with requestAnimationFrame)
    useEffect(() => {
        htmlContentRef.current = htmlContent;

        if (rafIdRef.current) return;

        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (iframeRef.current) {
                const doc = iframeRef.current.contentDocument;
                if (doc) {
                    doc.open();
                    doc.write(htmlContentRef.current);
                    doc.close();
                }
            }
        });

        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [htmlContent]);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-white rounded-lg overflow-hidden border border-zinc-700 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${status === 'generating' ? 'bg-yellow-500 animate-pulse' :
                        status === 'done' ? 'bg-green-500' :
                            status === 'error' ? 'bg-red-500' : 'bg-zinc-500'
                        }`} />
                    <span className="font-medium text-sm">
                        {status === 'generating' && '正在设计原型...'}
                        {status === 'done' && '原型生成完成'}
                        {status === 'error' && '生成失败'}
                        {status === 'idle' && '准备就绪'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'done' && fileUrl && (
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            在新窗口打开
                        </a>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative bg-white">
                {/* 错误提示 */}
                {status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 z-10">
                        <div className="text-center p-6 max-w-md">
                            <div className="text-red-500 mb-2 text-xl">⚠️</div>
                            <h3 className="text-lg font-medium text-white mb-2">生成失败</h3>
                            <p className="text-zinc-400 text-sm mb-4">{errorMsg}</p>
                            <button
                                onClick={startGeneration}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-sm"
                            >
                                重试
                            </button>
                        </div>
                    </div>
                )}

                {/* Iframe 预览 */}
                <iframe
                    ref={iframeRef}
                    title="Prototype Preview"
                    className="w-full h-full border-0"
                    sandbox="allow-scripts"
                />

                {/* Loading Stats Overlay (Optional) */}
                {status === 'generating' && (
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                        {htmlContent.length} bytes generated
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrototypePreview;
