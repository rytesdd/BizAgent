import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import axios from 'axios';
import { IconAI, IconMenu, IconSend, IconAttachment, IconEmoji, IconPlus, IconTrash, IconChevronDown, IconCheck } from './svg-icons';
import Modal from './components/Modal';
import App from './App';
import { eventBus, EVENTS } from './utils/eventBus';

// 常量
const AUTHOR_TYPES = {
  AI_CLIENT: "AI_CLIENT",
  HUMAN_CLIENT: "HUMAN_CLIENT",
  AI_VENDOR: "AI_VENDOR",
  HUMAN_VENDOR: "HUMAN_VENDOR",
  SYSTEM: "SYSTEM",
};

// 轮询间隔（毫秒）
const POLL_INTERVAL = 3000;

// 统一配色（灰色系）
const UNIFIED_COLORS = {
  bg: 'bg-[#3f3f46]',
  bgLight: 'bg-[#27272a]',
  bgLighter: 'bg-[#27272a]/50',
  text: 'text-[#e4e4e7]',
  textMuted: 'text-[#a1a1aa]',
  border: 'border-[#3f3f46]',
};

// 根据 comments 的 quoted_text 在 prdText 中构建「普通 / 高亮」片段，用于黄色下划线 + 锚点定位
function buildPrdSegments(prdText, comments) {
  if (!prdText) return [];
  const ranges = [];
  (comments || []).forEach((comment) => {
    const qt = (comment.quoted_text || '').trim();
    if (!qt) return;
    let start = prdText.indexOf(qt);
    while (start >= 0) {
      const end = start + qt.length;
      const overlaps = ranges.some((r) => start < r.end && end > r.start);
      if (!overlaps) {
        ranges.push({ start, end, commentId: comment.id });
        break;
      }
      start = prdText.indexOf(qt, start + 1);
    }
  });
  ranges.sort((a, b) => a.start - b.start);
  let lastEnd = 0;
  const merged = ranges.filter((r) => {
    if (r.start < lastEnd) r.start = lastEnd;
    if (r.start >= r.end) return false;
    lastEnd = r.end;
    return true;
  });
  const segments = [];
  let pos = 0;
  merged.forEach((r) => {
    if (r.start > pos) segments.push({ type: 'normal', text: prdText.slice(pos, r.start) });
    segments.push({ type: 'highlight', text: prdText.slice(r.start, r.end), commentId: r.commentId });
    pos = r.end;
  });
  if (pos < prdText.length) segments.push({ type: 'normal', text: prdText.slice(pos) });
  return segments.length ? segments : [{ type: 'normal', text: prdText }];
}

// 视角配置
const VIEW_ROLES = {
  client: {
    name: '甲方',
    label: '甲方视角',
    emoji: '📋',
    description: '需求方 / 客户',
    chatTitle: '甲方 AI 助手',
    chatPlaceholder: '输入消息或 /review 审查文档...',
    color: UNIFIED_COLORS,
  },
  vendor: {
    name: '乙方',
    label: '乙方视角',
    emoji: '💼',
    description: '供应商 / 开发方',
    chatTitle: '乙方 AI 助手',
    chatPlaceholder: '输入消息咨询项目问题...',
    color: UNIFIED_COLORS,
  },
};

export default function AiChatDashboard() {
  // ============================================
  // 状态管理
  // ============================================
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrdGenerating, setIsPrdGenerating] = useState(false);  // PRD 生成状态
  const [inputValue, setInputValue] = useState('');
  const [isUnloading, setIsUnloading] = useState(false);
  
  // 甲乙方独立的消息状态
  const [clientMessages, setClientMessages] = useState([]);
  const [vendorMessages, setVendorMessages] = useState([]);
  
  const [comments, setComments] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [prdText, setPrdText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(true);
  
  // 全局视角切换
  const [viewRole, setViewRole] = useState('client');
  const [replyInputs, setReplyInputs] = useState({});
  
  // 会话管理状态
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const [clientSessions, setClientSessions] = useState([]);
  const [vendorSessions, setVendorSessions] = useState([]);
  const [currentClientSessionId, setCurrentClientSessionId] = useState(null);
  const [currentVendorSessionId, setCurrentVendorSessionId] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatScrollStateRef = useRef({ scrollTop: 0, wasAtBottom: true });
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionDropdownRef = useRef(null);

  // 点击评论时滚动 PRD 到对应被评论原文位置
  const scrollToCommentInPrd = useCallback((commentId) => {
    const el = document.getElementById(`comment-anchor-${commentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // 当前视角配置
  const currentRole = VIEW_ROLES[viewRole];
  
  // 当前视角的消息
  const currentMessages = viewRole === 'client' ? clientMessages : vendorMessages;
  const setCurrentMessages = viewRole === 'client' ? setClientMessages : setVendorMessages;

  // ============================================
  // 初始化和轮询
  // ============================================

  // 获取 AI 状态
  const fetchAiStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/ai/status');
      if (response.data.success) {
        setAiStatus(response.data.data);
      }
    } catch (error) {
      console.error('获取 AI 状态失败:', error);
    }
  }, []);

  // 释放本地模型
  const handleUnloadModel = async () => {
    if (isUnloading || isGenerating) return;
    
    setIsUnloading(true);
    try {
      const response = await axios.post('/api/ai/unload');
      if (response.data.success) {
        addSystemMessage(`✅ ${response.data.data.message}`);
      } else {
        addSystemMessage(`⚠️ ${response.data.error || '释放失败'}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      addSystemMessage(`❌ 模型释放失败: ${errorMsg}`);
    } finally {
      setIsUnloading(false);
    }
  };

  // 获取数据（支持视角分离和会话管理）
  // skipComments: PRD 生成完成后刷新时传 true，不覆盖评论（保持 []）
  const fetchData = useCallback(async (skipComments = false) => {
    try {
      const [clientMsgRes, vendorMsgRes, commentsRes, dbRes, clientSessionsRes, vendorSessionsRes] = await Promise.all([
        axios.get('/api/chat/messages', { params: { view_role: 'client' } }),
        axios.get('/api/chat/messages', { params: { view_role: 'vendor' } }),
        axios.get('/api/comments'),
        axios.get('/api/debug/db'),
        axios.get('/api/chat/sessions', { params: { view_role: 'client' } }),
        axios.get('/api/chat/sessions', { params: { view_role: 'vendor' } }),
      ]);

      if (clientMsgRes.data.success) {
        setClientMessages(clientMsgRes.data.data.messages || []);
      }
      if (vendorMsgRes.data.success) {
        setVendorMessages(vendorMsgRes.data.data.messages || []);
      }
      if (commentsRes.data.success && !skipComments) {
        setComments(commentsRes.data.data.comments || []);
      }
      if (dbRes.data.success) {
        setPrdText(dbRes.data.data.project_context?.prd_text || '');
      }
      // 会话列表
      if (clientSessionsRes.data.success) {
        setClientSessions(clientSessionsRes.data.data.sessions || []);
        setCurrentClientSessionId(clientSessionsRes.data.data.current_session_id);
      }
      if (vendorSessionsRes.data.success) {
        setVendorSessions(vendorSessionsRes.data.data.sessions || []);
        setCurrentVendorSessionId(vendorSessionsRes.data.data.current_session_id);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    }
  }, []);

  // 初始化
  useEffect(() => {
    fetchAiStatus();
    fetchData();
  }, [fetchAiStatus, fetchData]);

  // 轮询
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (!isGenerating) {
        fetchData();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [fetchData, isGenerating]);

  // 聊天区：消息/视角更新后若用户不在底部，恢复滚动位置（不自动回到底部）
  useEffect(() => {
    const el = chatScrollRef.current;
    const state = chatScrollStateRef.current;
    if (!el || state.wasAtBottom) return;
    const savedTop = state.scrollTop;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el.scrollTop !== savedTop) el.scrollTop = savedTop;
      });
    });
  }, [clientMessages, vendorMessages, viewRole]);

  // 监听生成状态
  useEffect(() => {
    const unsubscribeStart = eventBus.on(EVENTS.GENERATION_STARTED, () => {
      setIsGenerating(true);
    });
    const unsubscribeComplete = eventBus.on(EVENTS.GENERATION_COMPLETED, () => {
      setIsGenerating(false);
      fetchData();
    });

    return () => {
      unsubscribeStart();
      unsubscribeComplete();
    };
  }, [fetchData]);

  // 监听 PRD 更新事件（新 PRD 对应新评论，清空旧评论）
  useEffect(() => {
    const unsubscribePrdUpdated = eventBus.on(EVENTS.PRD_UPDATED, (data) => {
      if (data?.prdContent) {
        setPrdText(data.prdContent);
        setComments([]);
        console.log('PRD 已更新，来源:', data.source);
      }
    });

    const unsubscribePrdStart = eventBus.on(EVENTS.PRD_GENERATION_STARTED, () => {
      setIsPrdGenerating(true);
    });

    const unsubscribePrdComplete = eventBus.on(EVENTS.PRD_GENERATION_COMPLETED, () => {
      setIsPrdGenerating(false);
    });

    return () => {
      unsubscribePrdUpdated();
      unsubscribePrdStart();
      unsubscribePrdComplete();
    };
  }, []);

  // 点击外部关闭会话下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target)) {
        setIsSessionPanelOpen(false);
      }
    };

    if (isSessionPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSessionPanelOpen]);

  // ============================================
  // 消息发送
  // ============================================

  // 检测是否为 PRD 生成指令（前端预检，用于显示状态提示）
  const isPrdGenerationCommand = (text) => {
    const prdKeywords = [
      "生成PRD", "生成prd", "生成Prd",
      "写一个PRD", "写一个prd",
      "写个PRD", "写个prd",
      "帮我生成PRD", "帮我生成prd",
      "创建PRD", "创建prd",
      "帮我写PRD", "帮我写prd",
      "出一份PRD", "出一份prd",
      "生成需求文档", "写需求文档",
    ];
    return prdKeywords.some(keyword => text.includes(keyword));
  };

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content || isGenerating) return;

    setInputValue('');
    setIsGenerating(true);
    eventBus.emit(EVENTS.GENERATION_STARTED, {});

    try {
      // 检测是否是命令
      if (content.startsWith('/')) {
        await handleCommand(content);
      } else {
        const isPrdCommand = viewRole === 'vendor' && isPrdGenerationCommand(content);
        if (isPrdCommand) {
          setComments([]);
          addSystemMessage('📝 正在生成 PRD 文档…');
          eventBus.emit(EVENTS.PRD_GENERATION_STARTED, {});

          // 流式 PRD：用 fetch 消费 SSE，边收边更新预览
          const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, view_role: viewRole }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || res.statusText);
          }

          const contentType = res.headers.get('Content-Type') || '';
          if (contentType.includes('text/event-stream')) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulated = '';
            let lastEmit = 0;
            let receivedDone = false;
            const throttleMs = 80;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n\n');
              buffer = parts.pop() || '';

              for (const part of parts) {
                const line = part.trim();
                if (!line.startsWith('data: ')) continue;
                try {
                  const payload = JSON.parse(line.slice(6));
                  if (payload.type === 'delta' && payload.content) {
                    accumulated += payload.content;
                    const now = Date.now();
                    if (now - lastEmit >= throttleMs) {
                      lastEmit = now;
                      setPrdText(accumulated);
                      eventBus.emit(EVENTS.PRD_UPDATED, { prdContent: accumulated, source: 'chat' });
                    }
                  } else if (payload.type === 'done') {
                    receivedDone = true;
                    const finalContent = payload.prd_content ?? accumulated;
                    setPrdText(finalContent);
                    setComments([]);
                    eventBus.emit(EVENTS.PRD_UPDATED, { prdContent: finalContent, source: 'chat', description: payload.prd_description });
                    eventBus.emit(EVENTS.PRD_GENERATION_COMPLETED, { prdContent: finalContent, description: payload.prd_description });
                    await fetchData(true);
                  } else if (payload.type === 'error') {
                    addSystemMessage(`生成失败: ${payload.error || '未知错误'}`);
                  }
                } catch (_) {}
              }
            }
            if (!receivedDone && accumulated) {
              setPrdText(accumulated);
              eventBus.emit(EVENTS.PRD_UPDATED, { prdContent: accumulated, source: 'chat' });
            }
          } else {
            const data = await res.json();
            if (data.success && data.data?.type === 'prd_generation') {
              const { prd_content, prd_description } = data.data;
              setPrdText(prd_content);
              setComments([]);
              eventBus.emit(EVENTS.PRD_UPDATED, { prdContent: prd_content, source: 'chat', description: prd_description });
              eventBus.emit(EVENTS.PRD_GENERATION_COMPLETED, { prdContent: prd_content, description: prd_description });
              await fetchData(true);
            }
          }
        } else {
          // 普通聊天消息
          const response = await axios.post('/api/chat/send', {
            content,
            view_role: viewRole,
          });
          if (response.data.success) await fetchData();
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      addSystemMessage(`发送失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsGenerating(false);
      eventBus.emit(EVENTS.GENERATION_COMPLETED, {});
    }
  };

  // 处理命令
  const handleCommand = async (content) => {
    const command = content.toLowerCase();

    if (command.startsWith('/review') || command.startsWith('/审查')) {
      if (viewRole !== 'client') {
        addSystemMessage('⚠️ 审查功能仅限甲方视角使用');
        return;
      }
      await triggerClientReview();
    } else if (command.startsWith('/reply') || command.startsWith('/回复')) {
      if (viewRole !== 'vendor') {
        addSystemMessage('⚠️ 回复功能仅限乙方视角使用');
        return;
      }
      const parts = content.split(' ');
      const commentId = parts[1];
      if (commentId) {
        await triggerVendorReply(commentId);
      } else {
        addSystemMessage('请指定评论 ID，例如: /reply comment_xxx');
      }
    } else if (command.startsWith('/help') || command.startsWith('/帮助')) {
      const roleHelp = viewRole === 'client' 
        ? '• /review 或 /审查 - 触发 AI 审查当前文档\n'
        : '• /reply [评论ID] 或 /回复 [评论ID] - AI 回复指定评论\n';
      addSystemMessage(`当前身份：${currentRole.name}（${currentRole.description}）\n\n可用命令：\n${roleHelp}• /status 或 /状态 - 查看 AI 服务状态\n• /clear 或 /清空 - 清空当前聊天记录`);
    } else if (command.startsWith('/status') || command.startsWith('/状态')) {
      await fetchAiStatus();
      addSystemMessage(`AI 服务状态：\n• 提供商: ${aiStatus?.provider || '未知'}\n• 模型: ${aiStatus?.model || '未知'}\n• 状态: ${aiStatus?.isReady ? '就绪' : '未就绪'}`);
    } else if (command.startsWith('/clear') || command.startsWith('/清空')) {
      await axios.post('/api/debug/reset', { keep_config: true });
      await fetchData();
      addSystemMessage('聊天记录已清空');
    } else {
      addSystemMessage(`未知命令: ${content}\n输入 /help 查看帮助`);
    }
  };

  // 添加系统消息（仅本地，根据当前视角）
  const addSystemMessage = (content) => {
    const newMsg = {
      id: `system_${Date.now()}`,
      role: 'system',
      content,
      created_at: new Date().toISOString(),
    };
    
    if (viewRole === 'client') {
      setClientMessages(prev => [...prev, newMsg]);
    } else {
      setVendorMessages(prev => [...prev, newMsg]);
    }
  };

  // ============================================
  // 甲方审查
  // ============================================

  const triggerClientReview = async () => {
    if (!prdText) {
      addSystemMessage('请先上传或输入 PRD 文档');
      return;
    }

    addSystemMessage('🔍 开始审查文档...');

    try {
      const response = await axios.post('/api/client/review', { prd_text: prdText });
      if (response.data.success) {
        const newComments = response.data.data.comments || [];
        addSystemMessage(`✅ 审查完成，生成了 ${newComments.length} 条评论`);
        await fetchData();
      }
    } catch (error) {
      addSystemMessage(`❌ 审查失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // ============================================
  // 乙方回复
  // ============================================

  const triggerVendorReply = async (commentId) => {
    addSystemMessage(`🤖 AI 正在生成回复...`);

    try {
      const response = await axios.post('/api/vendor/reply', { comment_id: commentId, force: true });
      if (response.data.success) {
        addSystemMessage('✅ 回复已发送');
        await fetchData();
      }
    } catch (error) {
      addSystemMessage(`❌ 回复失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 新建对话（创建新会话）
  const handleNewChat = async () => {
    if (isGenerating) return;

    try {
      const response = await axios.post('/api/chat/clear', { view_role: viewRole });
      if (response.data.success) {
        // 清空本地状态
        if (viewRole === 'client') {
          setClientMessages([]);
        } else {
          setVendorMessages([]);
        }
        // 刷新会话列表
        await fetchData();
      }
    } catch (error) {
      console.error('新建对话失败:', error);
      addSystemMessage(`❌ 新建对话失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 切换会话
  const handleSwitchSession = async (sessionId) => {
    if (isGenerating) return;

    try {
      const response = await axios.post('/api/chat/sessions/switch', { 
        view_role: viewRole, 
        session_id: sessionId 
      });
      if (response.data.success) {
        // 刷新数据
        await fetchData();
        setIsSessionPanelOpen(false);
      }
    } catch (error) {
      console.error('切换会话失败:', error);
      addSystemMessage(`❌ 切换会话失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 删除会话
  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation(); // 阻止事件冒泡
    if (isGenerating) return;

    // 确认删除
    if (!confirm('确定要删除这个会话吗？')) return;

    try {
      const response = await axios.delete(`/api/chat/sessions/${sessionId}`, {
        params: { view_role: viewRole }
      });
      if (response.data.success) {
        // 刷新数据
        await fetchData();
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      addSystemMessage(`❌ 删除会话失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // 获取当前视角的会话列表
  const currentSessions = viewRole === 'client' ? clientSessions : vendorSessions;
  const currentSessionId = viewRole === 'client' ? currentClientSessionId : currentVendorSessionId;
  const currentSessionTitle = currentSessions.find(s => s.id === currentSessionId)?.title || '新对话';

  // 乙方真人回复
  const handleHumanReply = async (commentId) => {
    const replyContent = replyInputs[commentId]?.trim();
    if (!replyContent) {
      addSystemMessage('⚠️ 回复内容不能为空');
      return;
    }

    try {
      const response = await axios.post('/api/vendor/human-reply', {
        comment_id: commentId,
        reply_content: replyContent,
      });
      if (response.data.success) {
        addSystemMessage('✅ 回复已发送');
        setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
        await fetchData();
      }
    } catch (error) {
      addSystemMessage(`❌ 回复失败: ${error.response?.data?.error || error.message}`);
    }
  };

  // ============================================
  // 文件上传
  // ============================================

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      addSystemMessage(`📤 正在上传文件: ${file.name}...`);

      const response = await axios.post('/api/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const { content, type, metadata, file_name } = response.data.data;
        setPrdText(content);

        const metaInfo = metadata 
          ? `（${type} 格式，${metadata.pages ? metadata.pages + ' 页，' : ''}${metadata.characters || content.length} 字符）`
          : '';

        addSystemMessage(`📄 文件上传成功: ${file_name} ${metaInfo}`);
        if (viewRole === 'client') {
          addSystemMessage('💡 输入 /review 开始审查文档');
        }
        await fetchData();
      } else {
        throw new Error(response.data.error || '上传失败');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      addSystemMessage(`❌ 文件上传失败: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================
  // 渲染辅助函数
  // ============================================

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getRiskLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'high': return { bg: 'bg-red-500', text: 'text-red-400' };
      case 'medium': return { bg: 'bg-yellow-500', text: 'text-yellow-400' };
      case 'low': return { bg: 'bg-green-500', text: 'text-green-400' };
      default: return { bg: 'bg-blue-500', text: 'text-blue-400' };
    }
  };

  const getRiskLevelLabel = (level) => {
    switch (level?.toLowerCase()) {
      case 'high': return '高风险';
      case 'medium': return '中风险';
      case 'low': return '低风险';
      default: return '评论';
    }
  };

  const getAuthorLabel = (authorType) => {
    switch (authorType) {
      case AUTHOR_TYPES.AI_CLIENT: return '甲方 AI';
      case AUTHOR_TYPES.HUMAN_CLIENT: return '甲方';
      case AUTHOR_TYPES.AI_VENDOR: return '乙方 AI';
      case AUTHOR_TYPES.HUMAN_VENDOR: return '乙方';
      case AUTHOR_TYPES.SYSTEM: return '系统';
      default: return '未知';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 获取聊天消息列表
  const getAllItems = () => {
    return currentMessages.map(msg => ({
      type: 'message',
      id: msg.id,
      content: msg.content,
      role: msg.role,
      time: msg.created_at,
      isError: msg.isError,
    })).sort((a, b) => new Date(a.time) - new Date(b.time));
  };

  // ============================================
  // 渲染
  // ============================================

  return (
    <div className="bg-[#09090b] h-screen w-screen overflow-hidden flex flex-col">
      {/* ========== 全局顶部视角切换 ========== */}
      <div className="bg-[#09090b] border-b border-[#27272a] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[#f4f4f5] font-semibold">AI 协作博弈平台</h1>
          {/* 模型状态指示器 */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#18181b] border border-[#27272a]">
            <span className={`w-2 h-2 rounded-full ${
              aiStatus?.isReady ? 'bg-[#10b981] animate-pulse' : 'bg-[#ef4444]'
            }`} />
            <span className="text-xs text-[#a1a1aa]">
              {aiStatus?.provider === 'mock' && '🧪 Mock 模式'}
              {aiStatus?.provider === 'ollama' && `🦙 ${aiStatus?.model || 'Ollama'}`}
              {aiStatus?.provider === 'kimi' && `🌙 ${aiStatus?.model || 'Kimi'}`}
              {!aiStatus?.provider && '加载中...'}
            </span>
            <span className={`text-xs ${aiStatus?.isReady ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
              {aiStatus?.isReady ? '就绪' : '未连接'}
            </span>
          </div>
        </div>
        
        {/* 视角切换 Tab 和模型释放按钮 */}
        <div className="flex items-center gap-4">
          {/* 模型释放按钮 */}
          {aiStatus?.provider === 'ollama' && (
            <button
              onClick={handleUnloadModel}
              disabled={isUnloading || isGenerating}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 flex items-center gap-1.5 ${
                isUnloading
                  ? 'bg-[#27272a] border-[#3f3f46] text-[#71717a] cursor-wait'
                  : 'bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] hover:border-[#3f3f46]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="释放本地模型以回收内存"
            >
              {isUnloading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>释放中...</span>
                </>
              ) : (
                <>
                  <span>🧹</span>
                  <span>释放模型</span>
                </>
              )}
            </button>
          )}
          
          <span className="text-[#71717a] text-sm">切换视角：</span>
          <div className="flex rounded-lg border border-[#27272a] overflow-hidden">
            {Object.entries(VIEW_ROLES).map(([key, role]) => (
              <button
                key={key}
                onClick={() => setViewRole(key)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  viewRole === key
                    ? `${role.color.bgLight} ${role.color.text}`
                    : 'bg-[#18181b] text-[#71717a] hover:bg-[#27272a] hover:text-[#a1a1aa]'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========== 主内容区 ========== */}
      <div className="flex-1 flex overflow-hidden min-h-0">
              
              {/* ========== 左侧聊天栏 ========== */}
              <div className="bg-[#18181b] border-[#27272a] border-r border-solid flex flex-col h-full items-start shadow-[0px_20px_25px_0px_rgba(0,0,0,0.2)] w-[30%] min-w-[360px] flex-shrink-0">
                
                {/* 顶部标题栏 - 根据视角变色 */}
                <div className={`bg-[rgba(9,9,11,0.5)] border-b border-solid h-[61px] relative shrink-0 w-full ${currentRole.color.border}`}>
                  <div className="flex items-center justify-between h-full px-4">
                    <div className="flex gap-3 items-center flex-1 min-w-0">
                      <div className={`${currentRole.color.bgLighter} border ${currentRole.color.border} border-solid rounded-full size-8 flex items-center justify-center shrink-0`}>
                        <div className={`size-5 ${currentRole.color.text}`}>
                          <IconAI />
                        </div>
                      </div>
                      
                      {/* 会话选择器下拉菜单 */}
                      <div className="relative flex-1 min-w-0" ref={sessionDropdownRef}>
                        <button
                          onClick={() => setIsSessionPanelOpen(!isSessionPanelOpen)}
                          className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#27272a] transition-colors w-full text-left ${isSessionPanelOpen ? 'bg-[#27272a]' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#f4f4f5] text-sm truncate">{currentSessionTitle}</p>
                            <p className="text-[#71717b] text-xs truncate">
                              {aiStatus?.provider ? `${aiStatus.provider} / ${aiStatus.model}` : 'Loading...'}
                            </p>
                          </div>
                          <div className={`size-4 text-[#71717b] shrink-0 transition-transform ${isSessionPanelOpen ? 'rotate-180' : ''}`}>
                            <IconChevronDown />
                          </div>
                        </button>
                        
                        {/* 下拉菜单 */}
                        {isSessionPanelOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl z-50 overflow-hidden">
                            <div className="max-h-[280px] overflow-y-auto">
                              {currentSessions.length === 0 ? (
                                <div className="text-center text-[#52525c] py-4 text-xs">
                                  暂无会话历史
                                </div>
                              ) : (
                                currentSessions.map((session) => (
                                  <div
                                    key={session.id}
                                    onClick={() => handleSwitchSession(session.id)}
                                    className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                                      session.is_current 
                                        ? 'bg-[#27272a]' 
                                        : 'hover:bg-[#27272a]/50'
                                    }`}
                                  >
                                    {/* 选中指示器 */}
                                    <div className={`size-4 shrink-0 ${session.is_current ? 'text-[#10b981]' : 'text-transparent'}`}>
                                      <IconCheck />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm truncate ${session.is_current ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'}`}>
                                        {session.title}
                                      </p>
                                      <p className="text-[10px] text-[#52525c]">
                                        {session.message_count} 条消息
                                      </p>
                                    </div>
                                    
                                    {/* 删除按钮 */}
                                    {!session.is_current && (
                                      <button
                                        onClick={(e) => handleDeleteSession(session.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-[#71717a] hover:text-red-400 transition-all shrink-0"
                                        title="删除会话"
                                      >
                                        <div className="size-3.5">
                                          <IconTrash />
                                        </div>
                                      </button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 新建对话按钮 */}
                    <button
                      className="rounded-lg size-8 flex items-center justify-center cursor-pointer hover:bg-[#27272a] transition-colors shrink-0 ml-2"
                      onClick={handleNewChat}
                      disabled={isGenerating}
                      title="新建对话"
                    >
                      <div className="size-4 text-[#71717b]">
                        <IconPlus />
                      </div>
                    </button>
                    
                    {/* 配置按钮 */}
                    <button
                      className="rounded-lg size-8 flex items-center justify-center cursor-pointer hover:bg-[#27272a] transition-colors shrink-0"
                      onClick={() => setIsConfigOpen(true)}
                      title="打开配置面板"
                    >
                      <div className="size-4 text-[#71717b]">
                        <IconMenu />
                      </div>
                    </button>
                  </div>
                </div>

                {/* 消息列表 */}
                <div
                  ref={chatScrollRef}
                  className="flex-1 min-h-0 relative w-full overflow-y-auto p-4 chat-scroll-no-anchor"
                  onScroll={(e) => {
                    const el = e.target;
                    chatScrollStateRef.current = {
                      scrollTop: el.scrollTop,
                      wasAtBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 50,
                    };
                  }}
                >
                  {getAllItems().length === 0 ? (
                    <div className="text-center text-[#52525c] py-8">
                      <div className={`text-4xl mb-4`}>{currentRole.emoji}</div>
                      <p className="mb-2">{currentRole.name}聊天</p>
                      <p className="text-xs">输入 /help 查看可用命令</p>
                    </div>
                  ) : (
                    getAllItems().map((item) => (
                      <div key={item.id} className={`flex flex-col gap-1 mb-4 ${
                        item.role === 'user' ? 'items-end' : 'items-start'
                      }`}>
                        {/* 消息气泡 */}
                        <div className={`min-h-[40px] max-w-[85%] rounded-2xl p-3 ${
                          item.role === 'user'
                            ? 'bg-[#3f3f46] rounded-tr-md'
                            : item.role === 'system'
                            ? 'bg-[#27272a] border border-[#3f3f46]'
                            : 'bg-[#27272a] border border-[#3f3f46] rounded-tl-md'
                        } ${item.isError ? 'border-red-500/50' : ''}`}>
                          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                            item.role === 'user'
                              ? 'text-white'
                              : item.isError
                              ? 'text-red-400'
                              : 'text-[#e4e4e7]'
                          }`}>
                            {item.content}
                          </p>
                        </div>
                        
                        {/* 时间戳 */}
                        <div className={`text-[#71717b] text-[10px] ${
                          item.role === 'user' ? 'mr-1' : 'ml-1'
                        }`}>
                          {formatTime(item.time)}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* 生成中指示器 */}
                  {isGenerating && (
                    <div className="flex items-start gap-2 mb-4">
                      <div className="bg-[#27272a] rounded-2xl rounded-tl-md p-3">
                        <div className="flex gap-1">
                          <div className={`w-2 h-2 ${currentRole.color.bg} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
                          <div className={`w-2 h-2 ${currentRole.color.bg} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
                          <div className={`w-2 h-2 ${currentRole.color.bg} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* 底部输入区 */}
                <div className="bg-[#09090b] border-[#27272a] border-solid border-t relative shrink-0 w-full p-4">
                  <div className="bg-[#18181b] rounded-xl overflow-hidden">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={currentRole.chatPlaceholder}
                      disabled={isGenerating}
                      className="w-full bg-transparent text-[#f4f4f5] placeholder-[#52525c] text-sm p-3 resize-none outline-none min-h-[60px] max-h-[120px]"
                      rows={2}
                    />
                    
                    {/* 工具栏 */}
                    <div className="flex items-center justify-between px-2 pb-2">
                      <div className="flex gap-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          accept=".txt,.md,.pdf"
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="rounded-lg size-8 flex items-center justify-center cursor-pointer hover:bg-[#27272a] transition-colors disabled:opacity-50"
                          title="上传文档 (TXT/MD/PDF)"
                        >
                          <div className="size-4 text-[#71717b]">
                            <IconAttachment />
                          </div>
                        </button>
                        <button
                          className="rounded-lg size-8 flex items-center justify-center cursor-pointer hover:bg-[#27272a] transition-colors"
                          title="表情"
                        >
                          <div className="size-4 text-[#71717b]">
                            <IconEmoji />
                          </div>
                        </button>
                      </div>
                      
                      {/* 发送按钮 */}
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isGenerating}
                        className={`bg-[#3f3f46] hover:bg-[#52525c] rounded-lg size-8 flex items-center justify-center transition-all ${
                          inputValue.trim() && !isGenerating
                            ? 'opacity-100 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="size-4 text-[#f4f4f5]">
                          <IconSend />
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {uploadedFile && (
                    <div className="mt-2 text-xs text-[#71717b]">
                      📄 {uploadedFile.name}
                    </div>
                  )}
                </div>
              </div>

              {/* ========== 中间 PRD 预览区 ========== */}
              <div className={`bg-[#09090b] h-full flex-1 flex flex-col overflow-hidden p-4 transition-all duration-300 ${
                isCommentPanelOpen ? 'w-[50%]' : 'w-[70%]'
              }`}>
                <div className="bg-[rgba(24,24,27,0.5)] border border-[#27272a] border-solid flex flex-col h-full overflow-hidden rounded-xl">
                  <div className="border-b border-[#27272a] px-4 py-3 text-sm text-[#a1a1aa] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>PRD 文档预览</span>
                      <span className="text-[#52525c]">（甲乙方共享）</span>
                    </div>
                    {/* PRD 生成中状态指示器 */}
                    {isPrdGenerating && (
                      <div className="flex items-center gap-2 text-[#10b981]">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs">正在生成...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {isPrdGenerating ? (
                      <div className="text-[#52525c] text-center py-16">
                        <div className="text-4xl mb-4 animate-pulse">📝</div>
                        <p className="text-base mb-2 text-[#10b981]">正在生成 PRD 文档...</p>
                        <p className="text-xs">AI 正在根据您的需求描述生成完整的 PRD 文档</p>
                        <p className="text-xs mt-2 text-[#71717a]">这可能需要一些时间，请稍候</p>
                      </div>
                    ) : prdText ? (
                      <pre className="text-[#d4d4d8] text-sm whitespace-pre-wrap font-sans leading-relaxed">
                        {buildPrdSegments(prdText, comments).map((seg, i) =>
                          seg.type === 'normal' ? (
                            <Fragment key={i}>{seg.text}</Fragment>
                          ) : (
                            <span
                              key={i}
                              id={`comment-anchor-${seg.commentId}`}
                              className="underline decoration-yellow-400 decoration-2 bg-yellow-500/10 rounded-sm"
                            >
                              {seg.text}
                            </span>
                          )
                        )}
                      </pre>
                    ) : (
                      <div className="text-[#52525c] text-center py-16">
                        <div className="text-4xl mb-4">📄</div>
                        <p className="text-base mb-2">暂无文档</p>
                        <p className="text-xs">点击左下角 📎 按钮上传</p>
                        {viewRole === 'vendor' && (
                          <p className="text-xs mt-4 text-[#71717a]">
                            💡 乙方提示：在聊天中输入「生成PRD」指令可自动生成 PRD 文档
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ========== 右侧评论面板 ========== */}
              <div className={`bg-[#18181b] border-l border-[#27272a] h-full flex flex-col transition-all duration-300 ${
                isCommentPanelOpen ? 'w-[320px]' : 'w-0'
              } overflow-hidden`}>
                {isCommentPanelOpen && (
                  <>
                    {/* 评论面板头部 */}
                    <div className={`flex items-center justify-between h-[52px] px-4 border-b shrink-0 ${currentRole.color.border} bg-[rgba(9,9,11,0.5)]`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${currentRole.color.text}`}>
                          {currentRole.name}视角
                        </span>
                        <span className="text-[#52525c]">|</span>
                        <span className="text-sm text-[#a1a1aa]">
                          评论（{comments.length}）
                        </span>
                      </div>
                      <button
                        onClick={() => setIsCommentPanelOpen(false)}
                        className="text-[#71717a] hover:text-[#a1a1aa] transition-colors text-lg font-light"
                        title="收起评论面板"
                      >
                        »
                      </button>
                    </div>

                    {/* 视角功能提示 */}
                    <div className={`px-4 py-2 text-xs border-b border-[#27272a] ${currentRole.color.bgLighter} ${currentRole.color.text}`}>
                      {viewRole === 'client' 
                        ? '甲方：可发起AI审查生成评论，查看乙方回复'
                        : '乙方：可查看甲方评论，进行AI回复或真人回复'}
                    </div>

                    {/* AI 审查文档 - 侧栏直接子元素 */}
                    {viewRole === 'client' && (
                      <button
                        onClick={triggerClientReview}
                        disabled={isGenerating || !prdText}
                        className={`w-[120px] h-8 px-3 py-2 text-sm ${currentRole.color.bgLight} ${currentRole.color.text} rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3`}
                        style={{ fontFamily: '"Noto Color Emoji"' }}
                        title={!prdText ? '请先上传文档' : 'AI 审查文档'}
                      >
                        AI 审查文档
                      </button>
                    )}

                    {/* 评论列表 */}
                    <div className="bg-[#09090b] border-[#27272a] border-solid border-t relative w-full p-4 flex-1 overflow-y-auto min-h-0">
                      {comments.length === 0 ? (
                        <div className="text-[#52525c] text-center py-12 px-4">
                          <p className="text-sm">暂无评论</p>
                          <p className="text-xs mt-2">
                            {viewRole === 'client' 
                              ? '上传文档后点击"AI 审查文档"开始'
                              : '等待甲方发起评论'}
                          </p>
                        </div>
                      ) : (
                        <div className="py-2">
                          {comments.map((comment) => {
                            const riskColor = getRiskLevelColor(comment.risk_level);
                            const hasQuoted = !!(comment.quoted_text || '').trim();
                            return (
                              <div key={comment.id} className="px-4 py-3 hover:bg-[#27272a]/30 transition-colors">
                                <div className="flex gap-3">
                                  <div className={`w-1 rounded-full ${riskColor.bg} shrink-0`} />
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <span className={`text-xs ${riskColor.text}`}>
                                        {getRiskLevelLabel(comment.risk_level)}
                                      </span>
                                      {hasQuoted && (
                                        <button
                                          type="button"
                                          onClick={() => scrollToCommentInPrd(comment.id)}
                                          className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer shrink-0"
                                          title="在 PRD 文档中定位到被评论的原文"
                                        >
                                          定位到文档
                                        </button>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-full bg-[#3f3f46] flex items-center justify-center text-[#f4f4f5] text-xs font-medium shrink-0">
                                        甲
                                      </div>
                                      <span className="text-xs text-[#a1a1aa]">
                                        {getAuthorLabel(comment.author_type)}
                                      </span>
                                      <span className="text-xs text-[#52525c]">
                                        {formatDate(comment.created_at)}
                                      </span>
                                    </div>
                                    
                                    <p className="text-sm text-[#e4e4e7] leading-relaxed">
                                      {comment.content}
                                    </p>

                                    {/* 回复区域 */}
                                    {comment.reply_content ? (
                                      <div className="mt-3 pl-3 border-l-2 border-[#3f3f46]">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="w-5 h-5 rounded-full bg-[#3f3f46] flex items-center justify-center text-[#f4f4f5] text-[10px] font-medium">
                                            乙
                                          </div>
                                          <span className="text-xs text-[#71717a]">
                                            {comment.reply_author_type === 'HUMAN_VENDOR' ? '乙方真人回复' : '乙方 AI 回复'}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[#a1a1aa] leading-relaxed">
                                          {comment.reply_content}
                                        </p>
                                      </div>
                                    ) : viewRole === 'vendor' ? (
                                      /* 乙方视角：可以回复 */
                                      <div className="mt-3 space-y-2">
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={replyInputs[comment.id] || ''}
                                            onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleHumanReply(comment.id);
                                              }
                                            }}
                                            placeholder="输入回复..."
                                            disabled={isGenerating}
                                            className="flex-1 bg-[#09090b] border border-[#27272a] rounded px-2 py-1 text-xs text-[#f4f4f5] placeholder-[#52525c] focus:outline-none focus:border-[#52525c] disabled:opacity-50"
                                          />
                                          <button
                                            onClick={() => handleHumanReply(comment.id)}
                                            disabled={isGenerating || !replyInputs[comment.id]?.trim()}
                                            className="px-2 py-1 text-xs bg-[#3f3f46] text-[#f4f4f5] rounded hover:bg-[#52525c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                          >
                                            发送
                                          </button>
                                        </div>
                                        <button
                                          onClick={() => triggerVendorReply(comment.id)}
                                          disabled={isGenerating}
                                          className="w-full text-xs text-[#71717a] hover:text-[#f4f4f5] disabled:opacity-50 transition-colors py-1 border border-dashed border-[#27272a] rounded hover:border-[#52525c]"
                                        >
                                          🤖 让 AI 自动回复
                                        </button>
                                      </div>
                                    ) : (
                                      /* 甲方视角：只能查看 */
                                      <div className="mt-2 text-xs text-[#52525c] italic">
                                        等待乙方回复...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 评论面板收起时的展开按钮 */}
              {!isCommentPanelOpen && (
                <button
                  onClick={() => setIsCommentPanelOpen(true)}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 ${currentRole.color.bgLight} hover:opacity-80 border ${currentRole.color.border} rounded-l-lg px-2 py-4 ${currentRole.color.text} transition-colors z-10`}
                  title="展开评论面板"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">«</span>
                    <span className="text-xs writing-mode-vertical">评论 ({comments.length})</span>
                  </div>
                </button>
              )}
      </div>
      
      {/* 配置弹窗 */}
      <Modal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)}
        title="AI 能力配置"
      >
        <App isEmbedded={true} />
      </Modal>
    </div>
  );
}
