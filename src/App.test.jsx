import React from 'react'

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#333' }}>✅ React 正常工作！</h1>
      <p>如果你看到这个页面，说明 Vite + React 已经成功运行。</p>
      <button 
        onClick={() => alert('点击成功！')}
        style={{
          padding: '10px 20px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        测试按钮
      </button>
    </div>
  )
}

export default App
