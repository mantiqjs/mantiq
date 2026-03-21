import './style.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { pages } from './pages.ts'

const target = document.getElementById('app')!
const data = (window as any).__MANTIQ_DATA__ ?? {}

// Clear SSR content and mount fresh — avoids hydration mismatches
// with shadcn-svelte sidebar components
target.innerHTML = ''
mount(App, { target, props: { pages, initialData: data } })
