import { useEffect } from 'react'
import { usePanel } from '@/hooks/usePanel'
import { useRouter } from '@/hooks/useRouter'
import { PanelLayout } from '@/components/layout/PanelLayout'
import { Icon } from '@/components/Icon'

// ── Placeholder page components ──────────────────────────────────────────────
// These will be replaced with full implementations in a later PR.

function ListPage({ slug }: { slug: string }) {
  const { panel } = usePanel()
  const resource = panel?.resources.find((r) => r.slug === slug)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {resource?.label ?? slug}
        </h1>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <p>Resource list for "{slug}" will be rendered here.</p>
      </div>
    </div>
  )
}

function CreatePage({ slug }: { slug: string }) {
  const { panel } = usePanel()
  const resource = panel?.resources.find((r) => r.slug === slug)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Create {resource?.label ?? slug}
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <p>Create form for "{slug}" will be rendered here.</p>
      </div>
    </div>
  )
}

function EditPage({ slug, id }: { slug: string; id: string }) {
  const { panel } = usePanel()
  const resource = panel?.resources.find((r) => r.slug === slug)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Edit {resource?.label ?? slug} #{id}
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <p>
          Edit form for "{slug}" record #{id} will be rendered here.
        </p>
      </div>
    </div>
  )
}

// ── Loading & Error states ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading panel...</p>
      </div>
    </div>
  )
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <Icon name="alert-triangle" className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">Failed to load panel</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Icon name="refresh-cw" className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { panel, loading, error, refetch } = usePanel()
  const { match, navigate } = useRouter()

  // Redirect root to first resource
  useEffect(() => {
    if (!panel) return

    const basePath = panel.path
    const currentPath = window.location.pathname

    // If at the panel root or no match, redirect to first resource
    if (
      (currentPath === basePath ||
        currentPath === basePath + '/' ||
        !match) &&
      panel.resources.length > 0
    ) {
      const firstSlug = panel.resources[0]!.slug
      navigate(`${basePath}/resources/${firstSlug}`)
    }
  }, [panel, match, navigate])

  // Loading state
  if (loading) {
    return <LoadingScreen />
  }

  // Error state
  if (error || !panel) {
    return (
      <ErrorScreen message={error ?? 'Panel not found'} onRetry={refetch} />
    )
  }

  // Route to correct page
  let page: React.ReactNode

  if (!match) {
    page = (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Icon name="file-question" className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        {panel.resources.length > 0 && (
          <button
            onClick={() =>
              navigate(
                `${panel.path}/resources/${panel.resources[0]!.slug}`,
              )
            }
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </button>
        )}
      </div>
    )
  } else if (match.pattern === '/resources/:slug') {
    page = <ListPage slug={match.params.slug!} />
  } else if (match.pattern === '/resources/:slug/create') {
    page = <CreatePage slug={match.params.slug!} />
  } else if (match.pattern === '/resources/:slug/:id/edit') {
    page = <EditPage slug={match.params.slug!} id={match.params.id!} />
  } else {
    page = null
  }

  return <PanelLayout>{page}</PanelLayout>
}
