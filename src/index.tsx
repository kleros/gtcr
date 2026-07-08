import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './bootstrap/app'

const container = document.querySelector('#root')
if (!container) throw new Error('Root element #root not found')
const root = createRoot(container)
root.render(<App />)
