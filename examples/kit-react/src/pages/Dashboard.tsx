import { useState, useEffect, useCallback } from 'react'
import { api, post } from '../lib/api.ts'

interface User { id: number; name: string; email: string; role: string }

interface DashboardProps {
  appName?: string
  currentUser?: User | null
  users?: User[]
  navigate: (href: string) => void
  [key: string]: any
}

export default function Dashboard({ appName = 'examples/kit-react', currentUser, users: initialUsers, navigate }: DashboardProps) {
  const [users, setUsers] = useState<User[]>(initialUsers ?? [])
  const [loading, setLoading] = useState(!initialUsers?.length)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { ok, data } = await api('/api/users')
    if (ok) setUsers(data.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!initialUsers?.length) fetchUsers()
  }, [fetchUsers, initialUsers])

  const handleLogout = async () => {
    await post('/logout', {})
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">{appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{currentUser?.name}</span>
            <button onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {currentUser?.name}.</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-200">Users</h2>
            <span className="text-xs text-gray-500">{loading ? 'Loading...' : `${users.length} total`}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-900/50 transition-colors">
                  <td className="px-5 py-3 text-gray-200">{u.name}</td>
                  <td className="px-5 py-3 text-gray-400">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>{u.role}</span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-600">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
