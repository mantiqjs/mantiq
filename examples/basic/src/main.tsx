import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'

const root = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}

createRoot(root).render(<App {...data} />)
