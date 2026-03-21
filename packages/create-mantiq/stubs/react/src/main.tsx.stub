import './style.css'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const app = <MantiqApp pages={pages} />

// Hydrate if SSR content exists, otherwise CSR mount
root.innerHTML.trim() ? hydrateRoot(root, app) : createRoot(root).render(app)
