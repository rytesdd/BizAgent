import React, { Suspense, useState, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { XProvider } from '@ant-design/x'
import AppVersionSwitch, { getStoredAppVersion } from './components/AppVersionSwitch'
import './index.css'
import './styles/progressive.css'

// v0.1: 原始入口（冻结）
import UnifiedChatEntry from './UnifiedChatEntry'
// v0.2: 新版入口（lazy load）
const UnifiedChatEntryV2 = lazy(() => import('./v2/UnifiedChatEntryV2'))

const getTheme = () => ({
  token: {
    fontSize: window.innerWidth < 768 ? 14 : 12,
    borderRadius: 6,
  },
})

function AppRoot() {
  const [appVersion, setAppVersion] = useState(getStoredAppVersion)

  const handleVersionChange = (newVersion) => {
    setAppVersion(newVersion)
  }

  return (
    <>
      <AppVersionSwitch current={appVersion} onChange={handleVersionChange} />
      <Suspense fallback={<div className="h-screen w-screen bg-black flex items-center justify-center text-white">Loading Interface...</div>}>
        {appVersion === 'v0.1' ? <UnifiedChatEntry /> : <UnifiedChatEntryV2 />}
      </Suspense>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={getTheme()}>
      <XProvider>
        <AppRoot />
      </XProvider>
    </ConfigProvider>
  </React.StrictMode>,
)
