#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'

const kernel = new Kernel()
const code = await kernel.run()
process.exit(code)
