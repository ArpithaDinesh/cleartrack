import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login/student" replace />
  }

  if (role && user.role !== role) {
    const roleMap = { student: '/dashboard/student', staff: '/dashboard/teacher', admin: '/dashboard/admin' }
    return <Navigate to={roleMap[user.role] || '/login/student'} replace />
  }

  return children
}
