---
name: page
description: Add a new frontend page with routing and navigation
user_invocable: true
---

# Add Page

Add a new frontend page with backend route and controller wiring.

## Arguments

`<PageName> [path]` — e.g., `Settings /settings`, `About /about`

## Process

### 1. Create the Controller Method

Add a method to an existing controller or create a new one:

```bash
bun mantiq make:controller <Name>Controller
```

The controller method should return page data as JSON with `_page`:

```typescript
async settings(request: MantiqRequest): Promise<Response> {
  return MantiqResponse.json({
    _page: 'Settings',
    _url: '/settings',
    // page-specific data here
  })
}
```

### 2. Add the Route

Edit `routes/web.ts`:

```typescript
router.get('/settings', [SettingsController, 'settings']).middleware('auth')
```

### 3. Create the Page Component

Create the page file based on the project's frontend kit:

**React** → `src/pages/Settings.tsx`:
```tsx
interface SettingsProps {
  navigate: (href: string) => void
  [key: string]: any
}

export default function Settings({ navigate }: SettingsProps) {
  return (
    <div>
      <h1>Settings</h1>
    </div>
  )
}
```

**Vue** → `src/pages/Settings.vue`
**Svelte** → `src/pages/Settings.svelte`

### 4. Register the Page

Add the page to the page registry in the entry file:

**React** → `src/main.tsx`:
```typescript
import Settings from './pages/Settings.tsx'
// Add to pages object:
const pages = { ..., Settings }
```

### 5. Add to SPA Router

If the app uses client-side navigation, add the path to the SPA routes array in `src/App.tsx`:
```typescript
const spaRoutes = [..., '/settings']
```

### 6. Verify

```bash
bun mantiq route:list
```

Start the server and navigate to the new page.
