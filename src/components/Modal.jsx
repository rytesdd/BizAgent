import { useEffect } from 'react';

/**
 * Modal 弹窗组件
 * 简约暗色主题：zinc-900 背景、zinc-800 边框
 * 布局：固定头部 / 可滚动内容（无滚动条）/ 固定底部
 */
export default function Modal({ isOpen, onClose, title, children, footer }) {
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

  const hasHeader = Boolean(title);
  const hasFooter = Boolean(footer);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 - 点击关闭 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 弹窗：flex 列布局 */}
      <div className="relative flex flex-col w-fit max-w-[90vw] h-[85vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 固定头部 */}
        {hasHeader && (
          <div className="flex shrink-0 items-center justify-between h-14 px-6 border-b border-zinc-800 bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
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

        {/* 可滚动内容区（滚动条隐藏） */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 ${hasHeader ? '' : 'pt-6'} ${hasFooter ? 'pb-4' : 'pb-6'}`}
        >
          {children}
        </div>

        {/* 固定底部 */}
        {hasFooter && (
          <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
