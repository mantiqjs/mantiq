import './style.css'
import { createApp, createSSRApp } from 'vue'
import App from './App.vue'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}

const app = root.innerHTML.trim()
  ? createSSRApp(App, { pages, initialData: data })
  : createApp(App, { pages, initialData: data })

app.mount('#app')
