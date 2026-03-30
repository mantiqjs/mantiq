import { type LucideProps, icons } from 'lucide-react'

interface IconProps extends LucideProps {
  name: string
}

export function Icon({ name, ...props }: IconProps) {
  // Convert kebab-case or snake_case to PascalCase for lucide lookup
  const pascalName = name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') as keyof typeof icons

  const LucideIcon = icons[pascalName]

  if (!LucideIcon) {
    // Fallback: try the name as-is (already PascalCase)
    const directMatch = icons[name as keyof typeof icons]
    if (directMatch) {
      const DirectIcon = directMatch
      return <DirectIcon {...props} />
    }
    // Final fallback: generic circle icon
    const FallbackIcon = icons.Circle
    return <FallbackIcon {...props} />
  }

  return <LucideIcon {...props} />
}
