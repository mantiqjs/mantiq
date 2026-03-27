import './style.css'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const app = <MantiqApp pages={pages} />

root.innerHTML.trim() ? hydrateRoot(root, app) : createRoot(root).render(app)
