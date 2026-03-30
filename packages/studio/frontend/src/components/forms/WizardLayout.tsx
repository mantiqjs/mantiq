import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { resolveComponent } from '@/components/registry'
import type { FormComponentSchema } from '@/components/forms/types'

interface WizardStepDefinition {
  label: string
  description?: string
  icon?: string
  schema: FormComponentSchema[]
}

export interface WizardLayoutProps {
  schema: FormComponentSchema & {
    steps?: WizardStepDefinition[]
  }
  value: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  errors?: Record<string, string[]>
}

export function WizardLayout({ schema, value, onChange, errors }: WizardLayoutProps) {
  const steps = schema.steps ?? []
  const [activeStep, setActiveStep] = useState(0)

  if (steps.length === 0) return null

  const currentStep = steps[activeStep]
  const isFirst = activeStep === 0
  const isLast = activeStep === steps.length - 1

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <nav className="flex items-center justify-center">
        <ol className="flex items-center gap-2">
          {steps.map((step, index) => {
            const isActive = index === activeStep
            const isCompleted = index < activeStep
            return (
              <li key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && 'bg-primary/10 text-primary',
                    !isActive && !isCompleted && 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    isActive && 'bg-primary-foreground text-primary',
                    isCompleted && 'bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                  )}>
                    {isCompleted ? (
                      <Icon name="check" className="h-3.5 w-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>

                {index < steps.length - 1 && (
                  <div className={cn(
                    'h-px w-8 sm:w-12',
                    isCompleted ? 'bg-primary' : 'bg-input',
                  )} />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step content */}
      {currentStep && (
        <div className="space-y-6">
          {(currentStep.label || currentStep.description) && (
            <div className="text-center">
              <h3 className="text-lg font-semibold">{currentStep.label}</h3>
              {currentStep.description && (
                <p className="mt-1 text-sm text-muted-foreground">{currentStep.description}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            {currentStep.schema.map((comp) => {
              const Component = resolveComponent(comp.type)
              if (!Component || comp.hidden) return null
              return (
                <Component
                  key={comp.name}
                  schema={comp}
                  value={value?.[comp.name] ?? comp.default ?? ''}
                  onChange={(val: unknown) => onChange(comp.name, val)}
                  error={errors?.[comp.name]}
                  errors={errors}
                />
              )
            })}
          </div>

          {/* Step navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-input">
            <button
              type="button"
              onClick={() => setActiveStep(activeStep - 1)}
              disabled={isFirst}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon name="arrow-left" className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              onClick={() => setActiveStep(activeStep + 1)}
              disabled={isLast}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Next
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
