import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI } from '../../services/api'

const statusColor = { draft:'neutral', submitted:'info', under_review:'warning', partially_approved:'warning', approved:'success', rejected:'danger' }
const statusLabel = { draft:'Draft', submitted:'Submitted', under_review:'Under Review', partially_approved:'Partially Approved', approved:'Approved ✓', rejected:'Rejected' }
const deptColor = { pending:'warning', approved:'success', rejected:'danger', not_applicable:'neutral' }

export default function ClearanceStatus() {
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

  const latest = requests[0]

  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Student Panel</small></div></div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          <Link to="/dashboard/student"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Dashboard</span></Link>
          <Link to="/upload-receipt"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload Receipt</span></Link>
          <Link to="/clearance-status" className="active"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Clearance Status</span></Link>
          <Link to="/request-history"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Request History</span></Link>
          <span className="nav-section-label" style={{marginTop:16}}>Account</span>
          <a href="#" className="nav-logout" onClick={(e)=>{e.preventDefault();logout();navigate('/login/student')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
        </nav>
        <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName}</span><small>{user?.universityNumber}</small></div></div></div>
      </aside>

      <div className="main-content">
        <header className="topbar"><div className="topbar-title">Clearance Status</div><div className="topbar-right"><div className="topbar-avatar">{initials}</div></div></header>
        <main className="page-content">
          <div className="page-header"><h1>Clearance Status</h1><p>Track the approval progress of your latest clearance request.</p></div>

          {loading ? <div className="card" style={{textAlign:'center',padding:48}}><p style={{color:'var(--text-sub)'}}>Loading status…</p></div>
          : !latest ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <p style={{color:'var(--text-sub)',marginBottom:16}}>No clearance requests found.</p>
              <Link to="/upload-receipt" className="btn btn-primary">Upload Receipt</Link>
            </div>
          ) : (
            <>
              {/* Overall status bar */}
              <div className={`status-bar ${latest.overallStatus === 'approved' ? 'eligible' : 'pending'}`} style={{marginBottom:24}}>
                <div className="sb-icon">
                  {latest.overallStatus === 'approved'
                    ? <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  }
                </div>
                <div className="sb-info">
                  <h3>{statusLabel[latest.overallStatus] || latest.overallStatus}</h3>
                  <p>Request #{latest.requestNumber} · Submitted {new Date(latest.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Department Cards */}
              <div className="cl-status-grid">
                {latest.departmentApprovals?.map(dept => (
                  <div key={dept.department} className="cl-status-card">
                    <div className="csc-label">{dept.department.charAt(0).toUpperCase()+dept.department.slice(1)} Department</div>
                    <div className="csc-title"><span className={`badge badge-${deptColor[dept.status]||'neutral'}`}>{dept.status.replace('_',' ')}</span></div>
                    {dept.reviewedAt && <div className="csc-meta">Reviewed: {new Date(dept.reviewedAt).toLocaleDateString()}</div>}
                    {dept.remarks && <div className="csc-reason">"{dept.remarks}"</div>}
                  </div>
                ))}
              </div>

              {/* OCR Data Summary */}
              {latest.ocrData?.transactionId && (
                <div className="card" style={{marginTop:8}}>
                  <h3 className="card-title" style={{fontSize:'.9rem',marginBottom:14}}>Payment Details</h3>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
                    {[['Transaction ID', latest.ocrData.transactionId],['Amount', latest.ocrData.amount],['Date', latest.ocrData.paymentDate],['Receipt No.', latest.ocrData.receiptNumber],['Bank', latest.ocrData.bankName],['Mode', latest.ocrData.paymentMode]].map(([l,v])=> v ? (
                      <div key={l} className="cf-field"><label>{l}</label><span>{v}</span></div>
                    ) : null)}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
