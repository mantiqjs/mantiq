import './style.css'
import { createRoot } from 'react-dom/client'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
root.innerHTML = ''
createRoot(root).render(<MantiqApp pages={pages} />)
