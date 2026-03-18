import { useState, useEffect, useCallback } from 'react'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface AppProps {
  appName?: string
  users?: User[]
}

export function App({ appName = 'MantiqJS', users: initialUsers = [] }: AppProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [form, setForm] = useState({ name: '', email: '', role: 'user' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users', { headers: { Accept: 'application/json' } })
    const json = await res.json()
    setUsers(json.data)
  }, [])

  const resetForm = () => {
    setForm({ name: '', email: '', role: 'user' })
    setEditingId(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const json = await res.json()
          setError(json.error?.message ?? 'Update failed')
          return
        }
      } else {
        // Create
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const json = await res.json()
          setError(json.error?.message ?? 'Create failed')
          return
        }
      }
      resetForm()
      await fetchUsers()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingId(user.id)
    setForm({ name: user.name, email: user.email, role: user.role })
    setError('')
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
    if (res.ok || res.status === 204) {
      await fetchUsers()
      if (editingId === id) resetForm()
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center p-8">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pt-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {appName}
          </h1>
          <p className="text-gray-400 text-lg">Full-Stack CRUD Demo</p>
          <p className="text-gray-600 text-sm">Bun + @mantiq/core + @mantiq/database + @mantiq/vite + React + Tailwind</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">
            {editingId ? `Edit User #${editingId}` : 'Create User'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Users Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">
              Users <span className="text-gray-500 font-normal">({users.length})</span>
            </h2>
            <button
              onClick={fetchUsers}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No users yet. Create one above.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-3 text-gray-500 text-sm">{user.id}</td>
                    <td className="px-6 py-3 font-medium">{user.name}</td>
                    <td className="px-6 py-3 text-gray-400">{user.email}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* API Explorer */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { href: '/api/ping', label: 'GET /api/ping' },
            { href: '/api/users', label: 'GET /api/users' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-blue-400 px-3 py-1.5 rounded-md border border-gray-700 hover:border-blue-400 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <p className="text-center text-gray-600 text-sm pb-8">
          Powered by Bun + React + Tailwind CSS
        </p>
      </div>
    </div>
  )
}
