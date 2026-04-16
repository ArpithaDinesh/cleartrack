import { useState } from 'react'
import Logo from '../../components/Logo'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function LoginTeacher() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authAPI.loginTeacher(email, password)
      login(data.token, data.user)
      navigate('/dashboard/teacher')
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-body">
      <div className="auth-wrapper" style={{ maxWidth: '420px' }}>
        <Logo />

        <div className="auth-card">
          <h2>Teacher Login</h2>
          <p className="subtitle">Sign in to your faculty portal</p>

          {/* Role switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <Link to="/login/student" className="btn btn-outline btn-sm" style={{ flex: 1, borderRadius: '8px' }}>Student</Link>
            <Link to="/login/teacher" className="btn btn-teal btn-sm" style={{ flex: 1, borderRadius: '8px' }}>Teacher</Link>
            <Link to="/login/admin" className="btn btn-outline btn-sm" style={{ flex: 1, borderRadius: '8px' }}>Admin</Link>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '.88rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                placeholder="e.g. teacher@college.edu"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-10px 0 18px' }}>
              <a href="#" style={{ fontSize: '.8rem', color: 'var(--teal)', fontWeight: '500' }}>Forgot password?</a>
            </div>
            <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          New faculty member? <Link to="/register/teacher" style={{ color: 'var(--teal)' }}>Register here</Link>
        </p>
      </div>
    </div>
  )
}
