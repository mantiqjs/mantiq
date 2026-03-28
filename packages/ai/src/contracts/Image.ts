export interface ImageGenerateOptions {
  model?: string
  n?: number
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024' | string
  quality?: 'standard' | 'hd' | string
  style?: 'natural' | 'vivid' | string
  responseFormat?: 'url' | 'b64_json'
}

export interface ImageEditOptions extends ImageGenerateOptions {
  mask?: Uint8Array
}

export interface ImageResult {
  images: GeneratedImage[]
  model: string
}

export interface GeneratedImage {
  url?: string
  b64Json?: string
  revisedPrompt?: string
}
