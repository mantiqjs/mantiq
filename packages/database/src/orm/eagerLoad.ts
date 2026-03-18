import type { Model, ModelStatic } from './Model.ts'
import type { ModelQueryBuilder } from './ModelQueryBuilder.ts'

/**
 * Eager-load relation configuration.
 * Supports string names or an object with constraint callbacks.
 */
export type EagerLoadSpec =
  | string
  | Record<string, (query: ModelQueryBuilder<any>) => void>

/**
 * Normalize `with()` arguments into a map of relation name → optional constraint callback.
 *
 * Supports:
 *   with('posts', 'profile')               → { posts: null, profile: null }
 *   with({ posts: q => q.where(...) })     → { posts: <fn> }
 *   with('posts.comments')                 → { posts: null } (nested handled recursively)
 */
export function normalizeEagerLoads(
  ...specs: EagerLoadSpec[]
): Map<string, ((query: ModelQueryBuilder<any>) => void) | null> {
  const map = new Map<string, ((query: ModelQueryBuilder<any>) => void) | null>()

  for (const spec of specs) {
    if (typeof spec === 'string') {
      // Handle dot-notation: 'posts.comments' → eager load 'posts', then nested 'comments'
      const root = spec.split('.')[0]!
      map.set(root, map.get(root) ?? null)
    } else {
      for (const [name, constraint] of Object.entries(spec)) {
        const root = name.split('.')[0]!
        map.set(root, constraint)
      }
    }
  }

  return map
}

/**
 * Extract nested relations from dot-notation specs.
 * e.g., ['posts.comments', 'posts.tags'] → { posts: ['comments', 'tags'] }
 */
export function extractNestedRelations(specs: string[]): Map<string, string[]> {
  const nested = new Map<string, string[]>()

  for (const spec of specs) {
    const dotIndex = spec.indexOf('.')
    if (dotIndex === -1) continue
    const root = spec.substring(0, dotIndex)
    const rest = spec.substring(dotIndex + 1)
    if (!nested.has(root)) nested.set(root, [])
    nested.get(root)!.push(rest)
  }

  return nested
}

/**
 * Eager-load relations on a set of already-fetched model instances.
 * Uses the N+1-safe approach: one query per relation regardless of parent count.
 *
 * @param models The parent models to load relations onto
 * @param relations Array of relation names (may include dot-notation for nesting)
 * @param constraints Optional map of relation name → query constraint callback
 */
export async function eagerLoadRelations<T extends Model>(
  models: T[],
  relations: string[],
  constraints?: Map<string, ((query: ModelQueryBuilder<any>) => void) | null>,
): Promise<void> {
  if (models.length === 0) return

  const nestedMap = extractNestedRelations(relations)

  // Deduplicate root relations
  const rootRelations = [...new Set(relations.map((r) => r.split('.')[0]!))]

  for (const relationName of rootRelations) {
    const firstModel = models[0]!
    const ctor = firstModel.constructor as typeof Model

    // Check if the model has this relation method
    if (typeof (firstModel as any)[relationName] !== 'function') {
      throw new Error(`Relation '${relationName}' is not defined on model '${ctor.table}'.`)
    }

    // Get the relation definition from the first model to understand the type
    const sampleRelation = (firstModel as any)[relationName]()
    const constraint = constraints?.get(relationName) ?? null

    if (sampleRelation.constructor.name === 'HasOneRelation') {
      await eagerLoadHasOne(models, relationName, sampleRelation, constraint)
    } else if (sampleRelation.constructor.name === 'HasManyRelation') {
      await eagerLoadHasMany(models, relationName, sampleRelation, constraint)
    } else if (sampleRelation.constructor.name === 'BelongsToRelation') {
      await eagerLoadBelongsTo(models, relationName, sampleRelation, constraint)
    } else if (sampleRelation.constructor.name === 'BelongsToManyRelation') {
      await eagerLoadBelongsToMany(models, relationName, sampleRelation, constraint)
    }

    // Handle nested relations (e.g., 'posts.comments')
    const nestedSpecs = nestedMap.get(relationName)
    if (nestedSpecs?.length) {
      // Collect all loaded related models
      const relatedModels: Model[] = []
      for (const model of models) {
        const loaded = (model as any)._relations[relationName]
        if (Array.isArray(loaded)) {
          relatedModels.push(...loaded)
        } else if (loaded) {
          relatedModels.push(loaded)
        }
      }
      if (relatedModels.length > 0) {
        await eagerLoadRelations(relatedModels, nestedSpecs)
      }
    }
  }
}

// ── HasOne eager loading ───────────────────────────────────────────────────

async function eagerLoadHasOne<T extends Model>(
  models: T[],
  relationName: string,
  sampleRelation: any,
  constraint: ((query: ModelQueryBuilder<any>) => void) | null,
): Promise<void> {
  const related = sampleRelation['related'] as ModelStatic<any>
  const foreignKey = sampleRelation['foreignKey'] as string
  const ctor = models[0]!.constructor as typeof Model
  const localKey = ctor.primaryKey

  const parentIds = models.map((m) => (m as any)._attributes[localKey]).filter((id) => id != null)
  if (!parentIds.length) return

  let query = related.query().whereIn(foreignKey, parentIds)
  if (constraint) constraint(query)

  const results = await query.get()
  const resultMap = new Map<any, any>()
  for (const result of results) {
    resultMap.set((result as any)._attributes[foreignKey], result)
  }

  for (const model of models) {
    const parentId = (model as any)._attributes[localKey]
    ;(model as any)._relations[relationName] = resultMap.get(parentId) ?? null
  }
}

// ── HasMany eager loading ──────────────────────────────────────────────────

async function eagerLoadHasMany<T extends Model>(
  models: T[],
  relationName: string,
  sampleRelation: any,
  constraint: ((query: ModelQueryBuilder<any>) => void) | null,
): Promise<void> {
  const related = sampleRelation['related'] as ModelStatic<any>
  const foreignKey = sampleRelation['foreignKey'] as string
  const ctor = models[0]!.constructor as typeof Model
  const localKey = ctor.primaryKey

  const parentIds = models.map((m) => (m as any)._attributes[localKey]).filter((id) => id != null)
  if (!parentIds.length) return

  let query = related.query().whereIn(foreignKey, parentIds)
  if (constraint) constraint(query)

  const results = await query.get()
  const resultMap = new Map<any, any[]>()
  for (const result of results) {
    const fkValue = (result as any)._attributes[foreignKey]
    if (!resultMap.has(fkValue)) resultMap.set(fkValue, [])
    resultMap.get(fkValue)!.push(result)
  }

  for (const model of models) {
    const parentId = (model as any)._attributes[localKey]
    ;(model as any)._relations[relationName] = resultMap.get(parentId) ?? []
  }
}

// ── BelongsTo eager loading ────────────────────────────────────────────────

async function eagerLoadBelongsTo<T extends Model>(
  models: T[],
  relationName: string,
  sampleRelation: any,
  constraint: ((query: ModelQueryBuilder<any>) => void) | null,
): Promise<void> {
  const related = sampleRelation['related'] as ModelStatic<any>
  const ownerKey = sampleRelation['ownerKey'] as string

  // Need to figure out the foreign key from the model's attributes
  // The BelongsToRelation stores the foreignId, but we need the foreignKey name
  // We derive it from the relation definition
  const relatedCtor = related as typeof Model
  const foreignKey = guessBelongsToForeignKey(models[0]!, relationName, relatedCtor)

  const foreignIds = models.map((m) => (m as any)._attributes[foreignKey]).filter((id) => id != null)
  if (!foreignIds.length) return

  const uniqueIds = [...new Set(foreignIds)]
  let query = related.query().whereIn(ownerKey, uniqueIds)
  if (constraint) constraint(query)

  const results = await query.get()
  const resultMap = new Map<any, any>()
  for (const result of results) {
    resultMap.set((result as any)._attributes[ownerKey], result)
  }

  for (const model of models) {
    const fkValue = (model as any)._attributes[foreignKey]
    ;(model as any)._relations[relationName] = resultMap.get(fkValue) ?? null
  }
}

function guessBelongsToForeignKey(model: Model, relationName: string, relatedCtor: typeof Model): string {
  // Convention: relation name + '_id' (e.g., 'author' → 'author_id')
  // But we also try the related model's table name in singular + '_id'
  const snaked = relationName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
  const possibleKey = `${snaked}_id`
  if (possibleKey in (model as any)._attributes) return possibleKey

  // Fallback: related model name in snake_case + '_id'
  const relatedName = relatedCtor.name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
  return `${relatedName}_id`
}

// ── BelongsToMany eager loading ────────────────────────────────────────────

async function eagerLoadBelongsToMany<T extends Model>(
  models: T[],
  relationName: string,
  sampleRelation: any,
  constraint: ((query: ModelQueryBuilder<any>) => void) | null,
): Promise<void> {
  const related = sampleRelation['related'] as ModelStatic<any>
  const pivotTable = sampleRelation['pivotTable'] as string
  const foreignKey = sampleRelation['foreignKey'] as string
  const relatedKey = sampleRelation['relatedKey'] as string
  const relatedCtor = related as typeof Model
  const ctor = models[0]!.constructor as typeof Model
  const localKey = ctor.primaryKey

  if (!relatedCtor.connection) return

  const parentIds = models.map((m) => (m as any)._attributes[localKey]).filter((id) => id != null)
  if (!parentIds.length) return

  // Step 1: Get all pivot rows for these parent IDs
  const pivotRows = await relatedCtor.connection.table(pivotTable)
    .whereIn(foreignKey, parentIds)
    .get()

  if (!pivotRows.length) {
    for (const model of models) {
      ;(model as any)._relations[relationName] = []
    }
    return
  }

  // Step 2: Get all related models
  const relatedIds = [...new Set(pivotRows.map((r) => r[relatedKey]))]
  let query = related.query().whereIn(relatedCtor.primaryKey, relatedIds)
  if (constraint) constraint(query)

  const results = await query.get()
  const resultMap = new Map<any, any>()
  for (const result of results) {
    resultMap.set((result as any)._attributes[relatedCtor.primaryKey], result)
  }

  // Step 3: Build parent → related[] mapping via pivot
  const parentRelatedMap = new Map<any, any[]>()
  for (const pivot of pivotRows) {
    const parentId = pivot[foreignKey]
    const relId = pivot[relatedKey]
    const relModel = resultMap.get(relId)
    if (!relModel) continue
    if (!parentRelatedMap.has(parentId)) parentRelatedMap.set(parentId, [])
    parentRelatedMap.get(parentId)!.push(relModel)
  }

  for (const model of models) {
    const parentId = (model as any)._attributes[localKey]
    ;(model as any)._relations[relationName] = parentRelatedMap.get(parentId) ?? []
  }
}
