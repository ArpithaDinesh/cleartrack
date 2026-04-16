import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI } from '../../services/api'

const badgeClass = { draft:'neutral', submitted:'info', under_review:'warning', partially_approved:'warning', approved:'success', rejected:'danger' }

export default function RequestHistory() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'S'

  useEffect(() => {
    clearanceAPI.getMyRequests()
      .then(d => setRequests(d.requests || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const Sidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Student Panel</small></div></div>
      <nav className="sidebar-nav">
        <span className="nav-section-label">Main Menu</span>
        <Link to="/dashboard/student"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Dashboard</span></Link>
        <Link to="/upload-receipt"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload Receipt</span></Link>
        <Link to="/clearance-status"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Clearance Status</span></Link>
        <Link to="/request-history" className="active"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Request History</span></Link>
        <span className="nav-section-label" style={{marginTop:16}}>Account</span>
        <a href="#" className="nav-logout" onClick={(e)=>{e.preventDefault();logout();navigate('/login/student')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
      </nav>
      <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName}</span><small>{user?.universityNumber}</small></div></div></div>
    </aside>
  )

  return (
    <div className="dashboard-body">
      <Sidebar/>
      <div className="main-content">
        <header className="topbar"><div className="topbar-title">Request History</div><div className="topbar-right"><div className="topbar-avatar">{initials}</div></div></header>
        <main className="page-content">
          <div className="page-header"><h1>Request History</h1><p>All your past clearance requests.</p></div>
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'20px 24px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 className="card-title" style={{margin:0}}>All Requests</h3>
              <Link to="/upload-receipt" className="btn btn-primary btn-sm">+ New Request</Link>
            </div>
            {loading ? <div style={{padding:40,textAlign:'center',color:'var(--text-sub)'}}>Loading…</div>
            : requests.length === 0 ? <div style={{padding:40,textAlign:'center',color:'var(--text-sub)'}}>No requests yet. <Link to="/upload-receipt" style={{color:'var(--primary)'}}>Upload your first receipt</Link></div>
            : (
              <div className="table-wrap" style={{border:'none',borderRadius:0,boxShadow:'none'}}>
                <table>
                  <thead><tr><th>Request #</th><th>Fee Type</th><th>Semester</th><th>Submitted</th><th>Status</th></tr></thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r._id}>
                        <td><strong>{r.requestNumber}</strong></td>
                        <td style={{textTransform:'capitalize'}}>{r.feeType}</td>
                        <td>{r.semester || '—'}</td>
                        <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                        <td><span className={`badge badge-${badgeClass[r.overallStatus]||'neutral'}`}>{r.overallStatus?.replace('_',' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
