import './style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PanelProvider } from '@/hooks/usePanel'
import { ThemeProvider } from '@/theme/ThemeProvider'
import App from '@/App'

const rootElement = document.getElementById('root')!

createRoot(rootElement).render(
  <StrictMode>
    <PanelProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PanelProvider>
  </StrictMode>,
)
