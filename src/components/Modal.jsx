import { useEffect } from 'react';

/**
 * Modal 弹窗组件
 * shadcn UI 风格，暗色主题
 */
export default function Modal({ isOpen, onClose, title, children }) {
  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 - 点击关闭 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="relative w-fit max-w-[90vw] h-[85vh] bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 头部 */}
        {title && (
          <div className="flex items-center justify-between h-[56px] px-8 border-b border-[#27272a] bg-[#09090b]">
            <h2 className="text-lg font-semibold text-[#f4f4f5]">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
              aria-label="关闭"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* 内容区域 */}
        <div
          className={`overflow-auto px-8 ${title ? 'h-[calc(100%-56px)]' : 'h-full'}`}
          style={{
            // 暗色滚动条样式
            scrollbarWidth: 'thin',
            scrollbarColor: '#3f3f46 transparent',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
