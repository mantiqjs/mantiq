import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Log Channel
  |--------------------------------------------------------------------------
  |
  | This option defines the default log channel that gets used when writing
  | messages to the logs. The "stack" channel sends to multiple channels
  | simultaneously (e.g., console + daily file).
  |
  */
  default: env('LOG_CHANNEL', 'stack'),

  /*
  |--------------------------------------------------------------------------
  | Log Channels
  |--------------------------------------------------------------------------
  |
  | Here you may configure the log channels for your application. Each
  | channel represents a specific destination for log messages.
  |
  | Supported drivers: 'stack', 'console', 'file', 'daily'
  | Log levels: 'emergency', 'alert', 'critical', 'error',
  |             'warning', 'notice', 'info', 'debug'
  |
  */
  channels: {
    // Sends messages to multiple channels at once
    stack: {
      driver: 'stack' as const,
      channels: ['console', 'daily'],
    },

    // Writes to stdout — ideal for development and container deployments
    console: {
      driver: 'console' as const,
      level: 'debug' as const,
    },

    // Rotates log files daily — automatically cleans up old files
    daily: {
      driver: 'daily' as const,
      path: 'storage/logs/mantiq.log',
      level: 'debug' as const,
      days: 14,  // Number of days to retain
    },

    // Single log file — no rotation
    file: {
      driver: 'file' as const,
      path: 'storage/logs/mantiq.log',
      level: 'debug' as const,
    },
  },
}
