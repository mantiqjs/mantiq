import './style.css'

// Register built-in components FIRST, before any component that uses the registry
import '@/components/registerBuiltins'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PanelProvider } from '@/hooks/usePanel'
import { ThemeProvider } from '@/theme/ThemeProvider'
import App from '@/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PanelProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PanelProvider>
  </StrictMode>,
)
