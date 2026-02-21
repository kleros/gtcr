import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './bootstrap/app'

const root = createRoot(document.querySelector('#root'))
root.render(<App />)
