/**
 * EventBus - 轻量级事件总线
 * 用于 AiChatDashboard 和 App（配置页面）之间的双向通信
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} - 取消订阅函数
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  /**
   * 取消订阅
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  /**
   * 发送事件
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   */
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach((callback) => callback(data));
  }

  /**
   * 只订阅一次
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

// 全局单例
export const eventBus = new EventBus();

// ============================================================
// 预定义事件类型（便于代码提示和文档）
// ============================================================

/**
 * 事件常量
 */
export const EVENTS = {
  // 配置页面 → 聊天界面
  CONFIG_UPDATED: 'config:updated', // 配置更新 { clientPersona, vendorPersona, prdText }

  // 聊天界面 → 配置页面
  GENERATION_STARTED: 'generation:started', // 开始生成
  GENERATION_COMPLETED: 'generation:completed', // 生成完成

  // PRD 相关事件
  PRD_UPDATED: 'prd:updated', // PRD 文档更新 { prdContent, source: 'chat' | 'upload' | 'manual' }
  PRD_GENERATION_STARTED: 'prd:generation:started', // PRD 生成开始
  PRD_GENERATION_COMPLETED: 'prd:generation:completed', // PRD 生成完成 { prdContent, description }
};

export default eventBus;
