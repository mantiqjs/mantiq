import { env } from '@mantiq/core'

/**
 * Logging Configuration
 *
 * Channels define where log messages are written. The 'stack' driver
 * sends messages to multiple channels simultaneously.
 *
 * Supported drivers: 'stack', 'console', 'file', 'daily'
 * Log levels: 'emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'
 */
export default {
  // Default channel — 'stack' sends to both console and daily file
  default: env('LOG_CHANNEL', 'stack'),

  channels: {
    // Sends to multiple channels at once
    stack: {
      driver: 'stack' as const,
      channels: ['console', 'daily'],
    },

    // Writes to stdout — useful for development and container environments
    console: {
      driver: 'console' as const,
      level: 'debug' as const,
    },

    // Rotates log files daily — keeps the last N days
    daily: {
      driver: 'daily' as const,
      path: 'storage/logs/mantiq.log',
      level: 'debug' as const,
      days: 14,  // Number of days to retain log files
    },

    // Single log file — no rotation
    file: {
      driver: 'file' as const,
      path: 'storage/logs/mantiq.log',
      level: 'debug' as const,
    },
  },
}
