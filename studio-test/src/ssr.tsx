import { renderToString } from 'react-dom/server'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

export function render(_url: string, data?: Record<string, any>) {
  return { html: renderToString(<MantiqApp pages={pages} initialData={data} />) }
}
