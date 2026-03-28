export interface AudioSpeechOptions {
  model?: string
  voice?: string
  speed?: number
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
}

export interface AudioTranscribeOptions {
  model?: string
  language?: string
  prompt?: string
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
  temperature?: number
  timestampGranularities?: ('word' | 'segment')[]
}

export interface TranscriptionResult {
  text: string
  language?: string
  duration?: number
  segments?: TranscriptionSegment[]
  words?: TranscriptionWord[]
}

export interface TranscriptionSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface TranscriptionWord {
  word: string
  start: number
  end: number
}
