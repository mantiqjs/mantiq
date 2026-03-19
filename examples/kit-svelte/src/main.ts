import './style.css'
import App from './App.svelte'
import { pages } from './pages.ts'

const target = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}

const app = new App({
  target,
  props: { pages, initialData: data },
  hydrate: !!target.innerHTML.trim(),
})

export default app
