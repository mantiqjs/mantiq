import { useEffect } from 'react'
import { usePanel } from '@/hooks/usePanel'
import { useRouter } from '@/hooks/useRouter'
import { PanelLayout } from '@/components/layout/PanelLayout'
import { ListPage } from '@/components/pages/ListPage'
import { CreatePage } from '@/components/pages/CreatePage'
import { EditPage } from '@/components/pages/EditPage'
import { Icon } from '@/components/Icon'

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

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
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
          Retry
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { panel, loading, error, refetch } = usePanel()
  const { match, navigate } = useRouter()

  // Redirect root to first resource
  useEffect(() => {
    if (!panel || match) return
    const currentPath = window.location.pathname
    if ((currentPath === '/' || currentPath === panel.path || currentPath === panel.path + '/') && panel.resources.length > 0) {
      navigate(`/resources/${panel.resources[0]!.slug}`)
    }
  }, [panel, match, navigate])

  if (loading) return <LoadingScreen />
  if (error || !panel) return <ErrorScreen message={error ?? 'Panel not found'} onRetry={refetch} />

  // Resolve resource from slug
  const slug = match?.params.slug
  const resource = slug ? panel.resources.find((r) => r.slug === slug) : undefined

  // Use the panel path as the base for all API calls (e.g., '/admin')
  const basePath = panel.path

  let page: React.ReactNode

  if (!match || !resource) {
    page = (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Icon name="file-question" className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
        {panel.resources.length > 0 && (
          <button
            onClick={() => navigate(`/resources/${panel.resources[0]!.slug}`)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </button>
        )}
      </div>
    )
  } else if (match.pattern === '/resources/:slug') {
    page = <ListPage resource={resource} basePath={basePath} onNavigate={navigate} />
  } else if (match.pattern === '/resources/:slug/create') {
    page = <CreatePage resource={resource} basePath={basePath} onNavigate={navigate} />
  } else if (match.pattern === '/resources/:slug/:id') {
    // View page — redirect to edit for now
    page = <EditPage resource={resource} recordId={match.params.id!} basePath={basePath} onNavigate={navigate} />
  } else if (match.pattern === '/resources/:slug/:id/edit') {
    page = <EditPage resource={resource} recordId={match.params.id!} basePath={basePath} onNavigate={navigate} />
  }

  return <PanelLayout>{page}</PanelLayout>
}
