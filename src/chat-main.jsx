import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { XProvider } from '@ant-design/x'
import UnifiedChatEntry from './UnifiedChatEntry'
import './index.css'
import './styles/progressive.css'

const theme = {
  token: {
    fontSize: 12,
    borderRadius: 6,
  },
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <XProvider>
        <Suspense fallback={<div className="h-screen w-screen bg-black flex items-center justify-center text-white">Loading Interface...</div>}>
          <UnifiedChatEntry />
        </Suspense>
      </XProvider>
    </ConfigProvider>
  </React.StrictMode>,
)
