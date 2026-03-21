import './style.css'
import { mount, hydrate } from 'svelte'
import App from './App.svelte'
import { pages } from './pages.ts'

const target = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}
const props = { pages, initialData: data }

if (target.innerHTML.trim()) {
  hydrate(App, { target, props })
} else {
  mount(App, { target, props })
}
