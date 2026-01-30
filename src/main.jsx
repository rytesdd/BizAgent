import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { XProvider } from '@ant-design/x'
import App from './App.jsx'
import './index.css'

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
        <App />
      </XProvider>
    </ConfigProvider>
  </React.StrictMode>,
)
