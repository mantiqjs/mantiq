export default {
  title: 'File Storage',
  content: `
<h2>Introduction</h2>
<p>The <code>@mantiq/filesystem</code> package provides a unified API for working with files across multiple storage backends. Whether you are storing files on the local disk or a cloud provider, the API remains the same. The driver-based architecture lets you switch storage backends without changing your application code.</p>

<h2>Configuration</h2>
<p>Filesystem configuration is defined in <code>config/filesystem.ts</code>. You can configure multiple "disks", each with its own driver and settings:</p>

<pre><code class="language-typescript">import { env } from '@mantiq/core'

export default {
  default: env('FILESYSTEM_DISK', 'local'),

  disks: {
    local: {
      driver: 'local',
      root: 'storage/app',
      url: '/storage',
    },

    public: {
      driver: 'local',
      root: 'storage/app/public',
      url: '/storage/public',
      visibility: 'public',
    },
  },
}
</code></pre>

<h3>Local Driver</h3>
<p>The <code>local</code> driver stores files on the server's filesystem relative to the project root. The <code>root</code> option defines the base directory for the disk, and <code>url</code> defines the URL prefix for generating public URLs.</p>

<h2>Registering the Service Provider</h2>
<p>Add <code>FilesystemServiceProvider</code> to your <code>bootstrap/providers.ts</code>:</p>

<pre><code class="language-typescript">import { FilesystemServiceProvider } from '@mantiq/filesystem'

export default [
  // ... other providers
  FilesystemServiceProvider,
]
</code></pre>

<h2>The storage() Helper</h2>
<p>The <code>storage()</code> helper provides quick access to the filesystem manager or a specific disk:</p>

<pre><code class="language-typescript">import { storage } from '@mantiq/filesystem'

// Access the FilesystemManager (defaults to the default disk)
const manager = storage()

// Access a specific disk
const local = storage('local')
const publicDisk = storage('public')
</code></pre>

<h2>Storing Files</h2>

<pre><code class="language-typescript">// Write a string to a file
await storage('local').put('documents/readme.txt', 'Hello, World!')

// Write binary data
const imageBytes = new Uint8Array([...])
await storage('local').put('images/photo.jpg', imageBytes, {
  mimeType: 'image/jpeg',
})

// Write from a stream
await storage('local').putStream('videos/clip.mp4', readableStream)

// Append content to an existing file
await storage('local').append('logs/app.log', 'New log entry\\n')

// Prepend content to an existing file
await storage('local').prepend('logs/app.log', 'First line\\n')
</code></pre>

<h2>Retrieving Files</h2>

<pre><code class="language-typescript">// Read file contents as a string
const content = await storage('local').get('documents/readme.txt')
// =&gt; 'Hello, World!' or null if not found

// Read as raw bytes
const bytes = await storage('local').getBytes('images/photo.jpg')
// =&gt; Uint8Array or null

// Stream a file
const stream = await storage('local').stream('videos/clip.mp4')
// =&gt; ReadableStream or null

// Check if a file exists
const exists = await storage('local').exists('documents/readme.txt')
// =&gt; true
</code></pre>

<h2>Deleting Files</h2>

<pre><code class="language-typescript">// Delete a single file
await storage('local').delete('documents/old.txt')

// Delete multiple files at once
await storage('local').delete([
  'temp/file1.txt',
  'temp/file2.txt',
  'temp/file3.txt',
])
</code></pre>

<h2>File Operations</h2>

<pre><code class="language-typescript">// Copy a file
await storage('local').copy('documents/original.txt', 'documents/copy.txt')

// Move (rename) a file
await storage('local').move('documents/old-name.txt', 'documents/new-name.txt')
</code></pre>

<h2>File Metadata</h2>

<pre><code class="language-typescript">// Get file size in bytes
const size = await storage('local').size('images/photo.jpg')
// =&gt; 1048576

// Get last modified timestamp (Unix epoch)
const modified = await storage('local').lastModified('documents/readme.txt')
// =&gt; 1710000000

// Get MIME type
const mime = await storage('local').mimeType('images/photo.jpg')
// =&gt; 'image/jpeg'

// Get the full filesystem path
const fullPath = storage('local').path('documents/readme.txt')
// =&gt; '/path/to/project/storage/app/documents/readme.txt'
</code></pre>

<h2>Generating URLs</h2>

<pre><code class="language-typescript">// Generate a URL for a file
const url = storage('public').url('images/avatar.jpg')
// =&gt; '/storage/public/images/avatar.jpg'
</code></pre>

<h2>Working with Directories</h2>

<pre><code class="language-typescript">// List files in a directory
const files = await storage('local').files('documents')
// =&gt; ['documents/readme.txt', 'documents/guide.pdf']

// List files recursively (including subdirectories)
const allFiles = await storage('local').allFiles('documents')

// List directories
const dirs = await storage('local').directories('storage')

// List directories recursively
const allDirs = await storage('local').allDirectories('storage')

// Create a directory
await storage('local').makeDirectory('uploads/2026/03')

// Delete a directory and its contents
await storage('local').deleteDirectory('temp')
</code></pre>

<h2>File Visibility</h2>
<p>You can control file visibility (permissions) on drivers that support it:</p>

<pre><code class="language-typescript">// Set visibility
await storage('local').setVisibility('documents/public-doc.txt', 'public')
await storage('local').setVisibility('documents/private-doc.txt', 'private')

// Get current visibility
const visibility = await storage('local').getVisibility('documents/public-doc.txt')
// =&gt; 'public'

// Set visibility during upload
await storage('local').put('uploads/file.txt', content, {
  visibility: 'public',
})
</code></pre>

<h2>Handling File Uploads</h2>
<p>Combine the filesystem with MantiqJS request handling for file uploads:</p>

<pre><code class="language-typescript">class AvatarController {
  async store(request: MantiqRequest) {
    const file = request.file('avatar')

    if (!file || !file.isValid()) {
      return MantiqResponse.json({ error: 'No valid file uploaded' }, 422)
    }

    // Store the file and get the path
    const path = await file.store('avatars', { disk: 'public' })

    // Save the path to the user's profile
    const user = request.user()
    user.set('avatar_path', path)
    await user.save()

    return MantiqResponse.json({
      url: storage('public').url(path),
    })
  }
}
</code></pre>

<h2>Error Handling</h2>
<p>The filesystem package throws specific errors for common failure cases:</p>

<table>
  <thead><tr><th>Error</th><th>When Thrown</th></tr></thead>
  <tbody>
    <tr><td><code>FileNotFoundError</code></td><td>Attempting to read, copy, or move a file that does not exist</td></tr>
    <tr><td><code>FileExistsError</code></td><td>Attempting to create a file that already exists (when using strict mode)</td></tr>
    <tr><td><code>FilesystemError</code></td><td>General filesystem operation failure (permissions, disk full, etc.)</td></tr>
  </tbody>
</table>

<h2>Multiple Disks</h2>
<p>You can define and use multiple disks for different purposes:</p>

<pre><code class="language-typescript">// Upload user files to the public disk
await storage('public').put('avatars/user-1.jpg', imageData)

// Store private documents on the local disk
await storage('local').put('contracts/nda.pdf', pdfData)
</code></pre>

<div class="note">
<p>The <code>storage()</code> helper without arguments returns the <code>FilesystemManager</code>, which proxies calls to the default disk. You can call <code>storage().disk('name')</code> to switch disks explicitly.</p>
</div>
`
}
