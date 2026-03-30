import type { NavigationGroupSchema, NavigationItemSchema } from '../schema/SchemaTypes.ts'
import type { Resource } from '../resources/Resource.ts'
import { NavigationGroup } from './NavigationGroup.ts'
import { NavigationItem } from './NavigationItem.ts'

/**
 * Builds a navigation tree from an array of Resource classes
 * and optional NavigationGroup definitions.
 */
export class NavigationBuilder {
  /**
   * Build navigation groups purely from resource static properties.
   * Resources with the same navigationGroup are grouped together.
   * Ungrouped resources (empty navigationGroup) go into a default group.
   */
  static buildFromResources(resources: Array<typeof Resource>): NavigationGroupSchema[] {
    const groups = new Map<string, NavigationItemSchema[]>()

    // Sort by navigationSort, then alphabetically by label
    const sorted = [...resources].sort((a, b) => {
      const sortDiff = a.navigationSort - b.navigationSort
      if (sortDiff !== 0) return sortDiff
      return a.resolveLabel().localeCompare(b.resolveLabel())
    })

    for (const resource of sorted) {
      const groupLabel = resource.navigationGroup || ''
      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, [])
      }

      const item: NavigationItemSchema = {
        label: resource.resolveLabel(),
        icon: resource.navigationIcon,
        url: `/resources/${resource.resolveSlug()}`,
        badge: undefined,
        badgeColor: undefined,
        isActive: false,
        children: [],
      }

      groups.get(groupLabel)!.push(item)
    }

    const result: NavigationGroupSchema[] = []

    // Ungrouped items first (empty string key)
    const ungrouped = groups.get('')
    if (ungrouped && ungrouped.length > 0) {
      result.push({
        label: '',
        icon: undefined,
        collapsible: false,
        items: ungrouped,
      })
    }

    // Then named groups, sorted alphabetically
    const namedGroups = [...groups.entries()]
      .filter(([key]) => key !== '')
      .sort(([a], [b]) => a.localeCompare(b))

    for (const [label, items] of namedGroups) {
      result.push({
        label,
        icon: undefined,
        collapsible: true,
        items,
      })
    }

    return result
  }

  /**
   * Build navigation using explicit group definitions, merging resource-derived items.
   * Groups provided here take precedence; resources not matching any group
   * are collected into an "Other" group.
   */
  static build(
    resources: Array<typeof Resource>,
    groups: NavigationGroup[],
  ): NavigationGroupSchema[] {
    // Start with the explicitly defined groups
    const result: NavigationGroupSchema[] = groups.map(g => g.toSchema() as unknown as NavigationGroupSchema)

    // Build a set of labels already covered by explicit groups
    const coveredLabels = new Set(result.map(g => g.label))

    // Find resources whose navigationGroup is NOT covered by explicit groups
    const uncoveredResources = resources.filter(r => !coveredLabels.has(r.navigationGroup))

    if (uncoveredResources.length > 0) {
      // Build navigation from uncovered resources and append
      const autoGroups = NavigationBuilder.buildFromResources(uncoveredResources)
      result.push(...autoGroups)
    }

    return result
  }
}
