<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte'

  let {
    pages = {},
    initialData = {},
  }: {
    pages?: Record<string, any>
    initialData?: Record<string, any>
  } = $props()

  const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
  const bootstrapData = (() => initialData ?? windowData)()

  let currentPage = $state<string>(bootstrapData._page ?? 'Login')
  let pageData = $state<Record<string, any>>(bootstrapData)

  const PageComponent = $derived(pages[currentPage] ?? null)

  // Initialize theme immediately to prevent flash
  if (typeof window !== 'undefined') {
    const theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }

  async function navigate(href: string) {
    const res = await fetch(href, {
      headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
    })

    // Handle 401/419 — session expired
    if (res.status === 401 || res.status === 419) {
      window.location.href = '/login'
      return
    }

    const newData = await res.json()
    currentPage = newData._page
    pageData = newData
    history.pushState(null, '', newData._url)
  }

  setContext('navigate', navigate)

  const spaRoutes = [
    '/login', '/register', '/dashboard', '/users',
    '/account/profile', '/account/security', '/account/preferences',
  ]

  function handleClick(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
    if (!spaRoutes.some(r => href === r || href.startsWith(r + '?'))) return
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
  <PageComponent {...pageData} {navigate} />
{/if}
