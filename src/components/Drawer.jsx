import { useEffect, useState } from 'react';

/**
 * Drawer 抽屉组件 - 从左侧滑入
 * 固定宽度 500px，暗色主题
 */
export default function Drawer({ isOpen, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const t = requestAnimationFrame(() => setMounted(true));
      return () => { cancelAnimationFrame(t); document.body.style.overflow = ''; };
    } else {
      setMounted(false);
      document.body.style.overflow = '';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩 - 点击关闭 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden
      />
      {/* 抽屉面板 - 左侧 500px，滑入动画 */}
      <div
        className={`relative w-[500px] h-full bg-[#09090b] border-r border-[#27272a] shadow-2xl flex flex-col transition-transform duration-200 ease-out ${mounted ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div className="flex items-center justify-between h-[56px] px-6 border-b border-[#27272a] bg-[#09090b] shrink-0">
            <h2 className="text-lg font-semibold text-[#f4f4f5]">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
              aria-label="关闭"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
}
