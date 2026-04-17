import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI, userAPI } from '../../services/api'
import ProfileModal from '../../components/ProfileModal'

const badgeMap = {
  'Fully Paid': 'badge-success', 'partial': 'badge-warning', 'Not Paid': 'badge-danger',
  approved: 'badge-success', rejected: 'badge-danger', pending: 'badge-warning', not_applicable: 'badge-neutral'
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'T'
  
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    // Fetch pending requests
    clearanceAPI.getDepartmentPending()
      .then(d => setPending(d.requests || []))
      .catch(console.error)
      .finally(() => setLoading(false))

    // Fetch assigned students
    userAPI.getMyStudents()
      .then(d => setStudents(d.students || []))
      .catch(console.error)
      .finally(() => setLoadingStudents(false))
  }, [])

  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Faculty Panel</small></div></div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          <Link to="/dashboard/teacher" className="active"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Dashboard</span></Link>
          <Link to="/staff/pending"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Pending Requests <span style={{background:'#fee2e2',color:'#991b1b',padding:'1px 7px',borderRadius:20,fontSize:'.7rem',fontWeight:700,marginLeft:4}}>{pending.length}</span></span></Link>
          <span className="nav-section-label" style={{marginTop:16}}>Account</span>
          <a href="#" className="nav-logout" onClick={e=>{e.preventDefault();logout();navigate('/login/teacher')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
        </nav>
        <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName}</span><small>{user?.staffId}</small></div></div></div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">Teacher Dashboard</div>
          <div className="topbar-right">
            <div className="topbar-badge" style={{ marginRight: '15px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: '#64748b' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div className="topbar-avatar" onClick={() => setShowDropdown(!showDropdown)} style={{cursor: 'pointer', position: 'relative'}}>
              {initials}
              {showDropdown && (
                <div style={{
                  position: 'absolute', top: '120%', right: 0, background: 'white',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                  borderRadius: '6px', overflow: 'hidden', minWidth: '150px', zIndex: 10
                }}>
                  <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', color: '#333', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => {setShowDropdown(false); setShowProfileModal(true)}}>
                    Edit Profile
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content">
          <div className="page-header"><h1>Faculty Overview</h1></div>

          {/* Profile */}
          <div className="profile-card" style={{flexDirection:'column',gap:0,marginBottom:28}}>
            <div style={{display:'flex',alignItems:'center',gap:20}}>
              <div className="profile-avatar">{initials}</div>
              <div className="profile-info" style={{padding:0, flex: 1}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>{user?.fullName}</h2>
                </div>
                <p className="profile-id">Teacher ID: {user?.staffId}</p>
                <div className="profile-tags" style={{marginTop:8}}>
                  <span className="profile-tag">{user?.department || 'Department not set'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{marginBottom:28}}>
            <div className="stat-card"><div className="stat-icon orange"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div className="stat-info"><h3>{loading ? '…' : pending.length}</h3><p>Pending Review</p></div></div>
          </div>

          {/* Pending Requests */}
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'18px 24px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 className="card-title" style={{margin:0}}>Pending Clearance Requests</h3>
              <Link to="/staff/pending" className="btn btn-primary btn-sm">View All</Link>
            </div>
            {loading ? <div style={{padding:32,textAlign:'center',color:'var(--text-sub)'}}>Loading requests…</div>
            : pending.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--success)',fontWeight:600}}>✓ No pending requests. All caught up!</div>
            : (
              <div className="cr-list" style={{padding:20}}>
                {pending.slice(0,3).map(r => {
                  const stu = r.student || {}
                  return (
                    <div key={r._id} className="cr-card">
                      <div className="cr-card-header">
                        <div className="cr-student-info"><div className="cr-avatar">{stu.fullName?.charAt(0)||'S'}</div><div><div className="cr-student-name">{stu.fullName}</div><div className="cr-univ-no">Univ: {stu.universityNumber} | Roll: {stu.rollNumber}</div></div></div>
                        <div style={{display:'flex',alignItems:'center',gap:10}}><span className="badge badge-warning">Pending</span><span className="cr-submitted-time">{r.submittedAt?new Date(r.submittedAt).toLocaleDateString():''}</span></div>
                      </div>
                      <div style={{padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:'.8rem',color:'var(--text-sub)'}}>Fee Type: <strong style={{textTransform:'capitalize'}}>{r.feeType}</strong></span>
                        <Link to={`/staff/request/${r._id}`} className="btn btn-primary btn-sm">Review →</Link>
                      </div>
                    </div>
                  )
                })}
                {pending.length > 3 && <div style={{textAlign:'center',paddingTop:8}}><Link to="/staff/pending" className="btn btn-outline btn-sm">View {pending.length-3} more…</Link></div>}
              </div>
            )}
          </div>
          {/* My Students Section */}
          <div className="card" style={{marginTop:28, padding:0, overflow:'hidden'}}>
            <div style={{padding:'18px 24px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 className="card-title" style={{margin:0}}>My Students ({user?.classDepartment} {user?.classYear})</h3>
              <span style={{fontSize:'.85rem', color:'var(--text-sub)'}}>{students.length} Total</span>
            </div>
            
            <div className="table-wrap" style={{border:'none', borderRadius:0, boxShadow:'none'}}>
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Univ Number</th>
                    <th>Roll No</th>
                    <th>Section</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:24}}>Loading students...</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:24, color:'var(--text-sub)'}}>No students found for this class.</td></tr>
                  ) : (
                    students.map(s => (
                      <tr key={s._id}>
                        <td><strong>{s.fullName}</strong></td>
                        <td style={{fontSize:'.85rem'}}>{s.universityNumber || '—'}</td>
                        <td style={{fontSize:'.85rem'}}>{s.rollNumber || '—'}</td>
                        <td style={{fontSize:'.85rem'}}>{s.section || '—'}</td>
                        <td>
                          <span className={`badge ${s.isActive ? 'badge-success' : 'badge-neutral'}`}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  )
}
