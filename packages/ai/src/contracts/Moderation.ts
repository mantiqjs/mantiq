export interface ModerationOptions {
  model?: string
}

export interface ModerationResult {
  id: string
  results: ModerationItem[]
}

export interface ModerationItem {
  flagged: boolean
  categories: Record<string, boolean>
  categoryScores: Record<string, number>
}
