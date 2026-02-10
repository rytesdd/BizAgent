/**
 * Chat Store - 使用 zustand 管理聊天状态
 * 
 * 将聊天消息状态从组件内部提升到全局 store，
 * 解决组件卸载重挂导致状态丢失的问题。
 */

import { create } from 'zustand';

// 默认欢迎消息
const DEFAULT_CLIENT_MESSAGES = [
    {
        key: 'welcome_client',
        role: 'ai',
        content: '你好！我是你的 BizAgent 业务助手。有什么可以帮助你的吗？'
    }
];

const DEFAULT_VENDOR_MESSAGES = [
    {
        key: 'welcome_vendor',
        role: 'ai',
        content: '你好！我是你的 BizAgent 业务助手。有什么可以帮助你的吗？'
    }
];

export const useChatStore = create((set, get) => ({
    // ==========================================
    // State
    // ==========================================
    
    // 甲方消息列表
    clientMessages: [...DEFAULT_CLIENT_MESSAGES],
    
    // 乙方消息列表
    vendorMessages: [...DEFAULT_VENDOR_MESSAGES],
    
    // 加载状态
    loading: false,
    
    // 输入框值
    inputValue: '',
    
    // 流式审查状态
    isReviewing: false,
    
    // 思考日志
    thinkingLog: '',

    // ==========================================
    // Actions
    // ==========================================
    
    // 设置甲方消息（兼容函数式更新：setMessages(prev => [...prev, msg])）
    setClientMessages: (messagesOrUpdater) => set((state) => ({
        clientMessages: typeof messagesOrUpdater === 'function'
            ? messagesOrUpdater(state.clientMessages)
            : messagesOrUpdater
    })),
    
    // 设置乙方消息（兼容函数式更新）
    setVendorMessages: (messagesOrUpdater) => set((state) => ({
        vendorMessages: typeof messagesOrUpdater === 'function'
            ? messagesOrUpdater(state.vendorMessages)
            : messagesOrUpdater
    })),
    
    // 根据角色添加消息
    addMessage: (role, message) => {
        const state = get();
        if (role === 'PARTY_A') {
            set({ clientMessages: [...state.clientMessages, message] });
        } else {
            set({ vendorMessages: [...state.vendorMessages, message] });
        }
    },
    
    // 根据角色更新最后一条消息
    updateLastMessage: (role, updater) => {
        const state = get();
        const key = role === 'PARTY_A' ? 'clientMessages' : 'vendorMessages';
        const messages = state[key];
        if (messages.length === 0) return;
        
        const lastIndex = messages.length - 1;
        const updatedMessages = [...messages];
        updatedMessages[lastIndex] = typeof updater === 'function' 
            ? updater(updatedMessages[lastIndex])
            : { ...updatedMessages[lastIndex], ...updater };
        
        set({ [key]: updatedMessages });
    },
    
    // 设置加载状态
    setLoading: (loading) => set({ loading }),
    
    // 设置输入值
    setInputValue: (inputValue) => set({ inputValue }),
    
    // 设置审查状态
    setIsReviewing: (isReviewing) => set({ isReviewing }),
    
    // 设置思考日志
    setThinkingLog: (thinkingLog) => set({ thinkingLog }),
    
    // 追加思考日志
    appendThinkingLog: (chunk) => {
        const state = get();
        set({ thinkingLog: state.thinkingLog + chunk });
    },
    
    // 重置单个角色的聊天
    resetChat: (role) => {
        if (role === 'PARTY_A') {
            set({ clientMessages: [...DEFAULT_CLIENT_MESSAGES] });
        } else {
            set({ vendorMessages: [...DEFAULT_VENDOR_MESSAGES] });
        }
    },
    
    // 重置所有聊天
    resetAllChats: () => set({
        clientMessages: [...DEFAULT_CLIENT_MESSAGES],
        vendorMessages: [...DEFAULT_VENDOR_MESSAGES],
        loading: false,
        inputValue: '',
        isReviewing: false,
        thinkingLog: '',
    }),

    // ==========================================
    // Selectors (便捷方法)
    // ==========================================
    
    // 根据当前角色获取消息
    getMessages: (role) => {
        const state = get();
        return role === 'PARTY_A' ? state.clientMessages : state.vendorMessages;
    },
    
    // 根据当前角色获取 setter
    getSetMessages: (role) => {
        const state = get();
        return role === 'PARTY_A' ? state.setClientMessages : state.setVendorMessages;
    },
}));
