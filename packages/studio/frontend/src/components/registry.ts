import type { ComponentType } from 'react'

const registry: Record<string, ComponentType<any>> = {}

export function registerComponent(type: string, component: ComponentType<any>): void {
  registry[type] = component
}

export function resolveComponent(type: string): ComponentType<any> | null {
  return registry[type] ?? null
}
