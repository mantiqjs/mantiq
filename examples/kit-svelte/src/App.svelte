<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte'

  export let pages: Record<string, any> = {}
  export let initialData: Record<string, any> = {}

  const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
  const initial = initialData ?? windowData

  let currentPage: string = initial._page ?? 'Login'
  let pageData: Record<string, any> = initial

  $: PageComponent = pages[currentPage] ?? null

  async function navigate(href: string) {
    const res = await fetch(href, {
      headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
    })
    const newData = await res.json()
    currentPage = newData._page
    pageData = newData
    history.pushState(null, '', newData._url)
  }

  setContext('navigate', navigate)

  function handleClick(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
    e.preventDefault()
    navigate(href)
  }

  function handlePop() { navigate(location.pathname) }

  onMount(() => {
    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePop)
  })

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePop)
    }
  })
</script>

{#if PageComponent}
  <svelte:component this={PageComponent} {...pageData} {navigate} />
{/if}
