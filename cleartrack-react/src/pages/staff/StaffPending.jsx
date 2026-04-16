import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI } from '../../services/api'

export default function StaffPending() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'T'

  useEffect(() => {
    clearanceAPI.getDepartmentPending()
      .then(d => setRequests(d.requests || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Faculty Panel</small></div></div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          <Link to="/dashboard/teacher"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Dashboard</span></Link>
          <Link to="/staff/pending" className="active"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Pending Requests</span></Link>
          <span className="nav-section-label" style={{marginTop:16}}>Account</span>
          <a href="#" className="nav-logout" onClick={(e)=>{e.preventDefault();logout();navigate('/login/teacher')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
        </nav>
        <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName}</span><small>{user?.staffId}</small></div></div></div>
      </aside>

      <div className="main-content">
        <header className="topbar"><div className="topbar-title">Pending Requests — {user?.assignedDepartment?.charAt(0)?.toUpperCase()+(user?.assignedDepartment?.slice(1)||'')} Dept.</div><div className="topbar-right"><div className="topbar-avatar">{initials}</div></div></header>
        <main className="page-content">
          <div className="page-header"><h1>Pending Requests</h1><p>Review and approve/reject student clearance requests for your department.</p></div>
          {loading ? <div className="card" style={{textAlign:'center',padding:40}}><p style={{color:'var(--text-sub)'}}>Loading requests…</p></div>
          : requests.length === 0 ? <div className="card" style={{textAlign:'center',padding:40}}><svg xmlns="http://www.w3.org/2000/svg" width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p style={{color:'var(--text-sub)',marginTop:12}}>No pending requests for your department 🎉</p></div>
          : (
            <div className="cr-list">
              {requests.map(r => {
                const stu = r.student || {}
                const initS = stu.fullName?.charAt(0)?.toUpperCase() || 'S'
                return (
                  <div key={r._id} className="cr-card">
                    <div className="cr-card-header">
                      <div className="cr-student-info">
                        <div className="cr-avatar">{initS}</div>
                        <div><div className="cr-student-name">{stu.fullName}</div><div className="cr-univ-no">Univ No: {stu.universityNumber} | Roll: {stu.rollNumber}</div></div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        <span className="badge badge-warning">Pending Review</span>
                        <span className="cr-submitted-time">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                    <div style={{padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                      <span style={{fontSize:'.8rem',color:'var(--text-sub)'}}>Fee Type: <strong style={{color:'var(--text-main)',textTransform:'capitalize'}}>{r.feeType}</strong></span>
                      <span style={{fontSize:'.8rem',color:'var(--text-sub)'}}>Request: <strong style={{color:'var(--text-main)'}}>{r.requestNumber}</strong></span>
                      <div style={{marginLeft:'auto'}}>
                        <Link to={`/staff/request/${r._id}`} className="btn btn-primary btn-sm">Review Request →</Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
