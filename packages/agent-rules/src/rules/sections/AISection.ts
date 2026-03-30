import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class AISection implements RuleSection {
  readonly id = 'ai'
  readonly title = 'AI Integration (@mantiq/ai)'
  readonly requires = ['ai']

  render(_packages: DetectedPackage[]): string {
    return `- \`ai()\` helper returns \`AIManager\` — multi-provider AI integration
- Providers: OpenAI, Anthropic, Gemini, Ollama, Azure OpenAI, Bedrock
- Chat: \`await ai().chat('gpt-4o').user('Hello').send()\`
- Streaming: \`for await (const chunk of ai().chat().user('Hi').stream()) { }\`
- Agent tools go in \`app/AI/Tools/\`, extend \`AgentTool\` from \`@mantiq/ai\`
- Override: \`name\`, \`description\`, \`parameters\` (JSON Schema), \`execute(args)\`
- Config: \`config/ai.ts\` — provider API keys, default model, limits`
  }
}
