// Commands
export { AgentGenerateCommand } from './commands/AgentGenerateCommand.ts'
export { AgentUpdateCommand } from './commands/AgentUpdateCommand.ts'

// Core
export { PackageDetector, type DetectedPackage } from './rules/PackageDetector.ts'
export { RuleRegistry, type RuleSection, type BuiltRules } from './rules/RuleRegistry.ts'

// Formats
export { Format, type GeneratedFile } from './formats/Format.ts'
export { ClaudeFormat } from './formats/ClaudeFormat.ts'
export { CursorFormat } from './formats/CursorFormat.ts'
export { CopilotFormat } from './formats/CopilotFormat.ts'
export { WindsurfFormat } from './formats/WindsurfFormat.ts'

// Sections
export { OverviewSection } from './rules/sections/OverviewSection.ts'
export { CommandsSection } from './rules/sections/CommandsSection.ts'
export { BaseClassSection } from './rules/sections/BaseClassSection.ts'
export { ImportMapSection } from './rules/sections/ImportMapSection.ts'
export { FilePlacementSection } from './rules/sections/FilePlacementSection.ts'
export { PatternsSection } from './rules/sections/PatternsSection.ts'
export { TestingSection } from './rules/sections/TestingSection.ts'
export { AntiPatternsSection } from './rules/sections/AntiPatternsSection.ts'
export { AuthSection } from './rules/sections/AuthSection.ts'
export { DatabaseSection } from './rules/sections/DatabaseSection.ts'
export { QueueSection } from './rules/sections/QueueSection.ts'
export { MailSection } from './rules/sections/MailSection.ts'
export { AISection } from './rules/sections/AISection.ts'
export { StudioSection } from './rules/sections/StudioSection.ts'
