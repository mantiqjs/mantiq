import { useEffect, type RefObject } from 'react'

const CLIPBOARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></rect></svg>`

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`

export function useCodeCopy(containerRef: RefObject<HTMLDivElement | null>, deps: any[] = []) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const pres = container.querySelectorAll('pre')
    pres.forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return

      const btn = document.createElement('button')
      btn.className = 'copy-btn'
      btn.innerHTML = CLIPBOARD_SVG
      btn.title = 'Copy code'
      btn.onclick = async () => {
        const code = pre.querySelector('code')?.textContent ?? ''
        await navigator.clipboard.writeText(code)
        btn.innerHTML = CHECK_SVG
        btn.classList.add('copied')
        setTimeout(() => {
          btn.innerHTML = CLIPBOARD_SVG
          btn.classList.remove('copied')
        }, 2000)
      }
      pre.appendChild(btn)
    })

    return () => {
      const buttons = container.querySelectorAll('.copy-btn')
      buttons.forEach((btn) => btn.remove())
    }
  }, deps)
}
