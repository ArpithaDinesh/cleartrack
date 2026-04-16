import { useState } from 'react'
import Logo from '../../components/Logo'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../services/api'

export default function RegisterAdmin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '', adminId: '', phone: '', email: '',
    password: '', confirmPassword: ''
  })

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      await authAPI.registerAdmin({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        staffId: form.adminId,
      })
      alert('✅ Admin account created! Please login.')
      navigate('/login/admin')
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-body" style={{ background: 'linear-gradient(135deg,#ede9fe 0%,#ddd6fe 40%,#e0e7ff 100%)' }}>
      <style>{`
        .btn-admin { background: linear-gradient(135deg,#7c3aed,#6d28d9); color: #fff; box-shadow: 0 2px 8px rgba(124,58,237,.30); }
        .btn-admin:hover { background: linear-gradient(135deg,#6d28d9,#5b21b6); box-shadow: 0 4px 14px rgba(124,58,237,.40); transform: translateY(-1px); }
        .auth-logo .logo-icon { background: linear-gradient(135deg,#7c3aed,#4f46e5) !important; }
        .auth-footer a { color: #7c3aed !important; }
      `}</style>
      <div className="auth-wrapper">
        <Logo adminTheme subtitle="College Academic Portal — Admin Registration" />
        <div className="auth-card">
          <h2>Admin Registration</h2>
          <p className="subtitle">Create a new administrator account</p>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '.88rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fullname">Full Name</label>
                <input type="text" id="fullname" placeholder="Enter full name" required value={form.fullName} onChange={set('fullName')} />
              </div>
              <div className="form-group">
                <label htmlFor="admin_id">Admin ID <span style={{ color: '#7c3aed', fontSize: '.7rem' }}>(Unique)</span></label>
                <input type="text" id="admin_id" placeholder="e.g. ADMIN001" required value={form.adminId} onChange={set('adminId')} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input type="tel" id="phone" placeholder="+91 9876543210" required value={form.phone} onChange={set('phone')} />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email ID</label>
                <input type="email" id="email" placeholder="admin@college.edu" required value={form.email} onChange={set('email')} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" placeholder="Min 6 characters" required value={form.password} onChange={set('password')} />
              </div>
              <div className="form-group">
                <label htmlFor="confirm_password">Confirm Password</label>
                <input type="password" id="confirm_password" placeholder="Confirm password" required value={form.confirmPassword} onChange={set('confirmPassword')} />
              </div>
            </div>

            <button type="submit" className="btn btn-admin btn-full" style={{ justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px' }} disabled={loading}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>
        <p className="auth-footer">
          Already registered? <Link to="/login/admin">Admin Login</Link>
        </p>
      </div>
    </div>
  )
}
