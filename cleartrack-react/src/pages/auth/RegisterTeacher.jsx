import { useState } from 'react'
import Logo from '../../components/Logo'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../services/api'

export default function RegisterTeacher() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '',
    staffId: '', department: '', classYear: '',
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
      await authAPI.registerTeacher({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        staffId: form.staffId,
        department: form.department,
        assignedDepartment: 'tuition',
      })
      alert('✅ Registration successful! Please login.')
      navigate('/login/teacher')
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-body">
      <div className="auth-wrapper">
        <Logo />
        <div className="auth-card">
          <h2>Teacher Registration</h2>
          <p className="subtitle">Create your faculty account</p>

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
                <label htmlFor="teacher_id">Teacher ID</label>
                <input type="text" id="teacher_id" placeholder="e.g. TCH2024001" required value={form.staffId} onChange={set('staffId')} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input type="tel" id="phone" placeholder="+91 9876543210" required value={form.phone} onChange={set('phone')} />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email ID</label>
                <input type="email" id="email" placeholder="teacher@college.edu" required value={form.email} onChange={set('email')} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="department">Department</label>
                <select id="department" required value={form.department} onChange={set('department')}>
                  <option value="" disabled>Select Department</option>
                  <option value="CS">CS</option>
                  <option value="IT">IT</option>
                  <option value="CE">CE</option>
                  <option value="ME">ME</option>
                  <option value="EC">EC</option>
                  <option value="EEE">EEE</option>
                  <option value="MCA">MCA</option>
                  <option value="MBA">MBA</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="class_teacher">Class Teacher Of</label>
                <select id="class_teacher" value={form.classYear} onChange={set('classYear')}>
                  <option value="">Select Class (optional)</option>
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" placeholder="Min 6 characters" required value={form.password} onChange={set('password')} />
              </div>
              <div className="form-group">
                <label htmlFor="confirm_password">Confirm Password</label>
                <input type="password" id="confirm_password" placeholder="Repeat password" required value={form.confirmPassword} onChange={set('confirmPassword')} />
              </div>
            </div>

            <button type="submit" className="btn btn-teal btn-full" style={{ marginTop: '6px' }} disabled={loading}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {loading ? 'Registering...' : 'Register Account'}
            </button>
          </form>
        </div>
        <p className="auth-footer">
          Already registered? <Link to="/login/teacher" style={{ color: 'var(--teal)' }}>Teacher Login</Link>
        </p>
      </div>
    </div>
  )
}
