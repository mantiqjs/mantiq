export default {

  /*
  |--------------------------------------------------------------------------
  | React Fast Refresh
  |--------------------------------------------------------------------------
  |
  | Injects the React Refresh preamble into dev mode HTML so that HMR
  | works correctly. Required for React — without it, components throw
  | "can't detect preamble" and the page renders blank.
  |
  | Set to false for Vue/Svelte (they don't need this preamble).
  |
  */
  reactRefresh: false,

  /*
  |--------------------------------------------------------------------------
  | Server-Side Rendering
  |--------------------------------------------------------------------------
  |
  | SSR renders pages on the server so users see content immediately
  | instead of a blank shell. The entry file exports a render() function.
  |
  | In dev: Vite's ssrLoadModule() loads the entry with HMR.
  | In prod: the pre-built bundle at bootstrap/ssr/ is used.
  |
  */
  // ssr: {
  //   entry: 'src/ssr.tsx',
  //   bundle: 'bootstrap/ssr/ssr.js',
  // },
}
