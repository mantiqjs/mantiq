<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, provide } from 'vue'

const props = defineProps<{
  pages: Record<string, any>
  initialData?: Record<string, any>
}>()

const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
const initial = props.initialData ?? windowData

const currentPage = ref<string>(initial._page ?? 'Login')
const pageData = ref<Record<string, any>>(initial)
const PageComponent = shallowRef(props.pages[currentPage.value] ?? null)

async function navigate(href: string) {
  const res = await fetch(href, {
    headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
  })
  const newData = await res.json()
  currentPage.value = newData._page
  pageData.value = newData
  PageComponent.value = props.pages[newData._page] ?? null
  history.pushState(null, '', newData._url)
}

provide('navigate', navigate)

function handleClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement).closest('a')
  const href = anchor?.getAttribute('href')
  if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
  e.preventDefault()
  navigate(href)
}

function handlePop() { navigate(location.pathname) }

onMounted(() => {
  document.addEventListener('click', handleClick)
  window.addEventListener('popstate', handlePop)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClick)
  window.removeEventListener('popstate', handlePop)
})
</script>

<template>
  <component :is="PageComponent" v-bind="pageData" :navigate="navigate" v-if="PageComponent" />
</template>
