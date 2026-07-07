'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-white/[0.07] rounded-xl shadow-2xl p-8 relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent/20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.1] rounded-xl flex items-center justify-center mb-4 text-accent shadow-inner">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">IYS Intelligence</h1>
          <p className="text-white/50 text-sm mt-1">Sign in to access the dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="relative z-10 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider pl-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface2 border border-white/[0.1] rounded-lg py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-white/60 uppercase tracking-wider pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface2 border border-white/[0.1] rounded-lg py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-accent hover:bg-accent/90 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(var(--accent),0.3)] hover:shadow-[0_0_25px_rgba(var(--accent),0.5)]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
