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
    setLoading(true)
    console.log('🔍 Fetching pending requests for teacher...', { 
      dept: user?.classDepartment, 
      year: user?.classYear,
      token: !!localStorage.getItem('cleartrack_token')
    });
    
    clearanceAPI.getDepartmentPending()
      .then(d => {
        console.log('✅ Pending API Response:', d);
        setPending(d.requests || [])
      })
      .catch(err => {
        console.error('❌ Pending API Error:', err);
      })
      .finally(() => setLoading(false))

    setLoadingStudents(true)
    userAPI.getMyStudents()
      .then(res => {
        console.log('✅ Students API Response:', res);
        setStudents(res.students || [])
      })
      .catch(err => {
        console.error('❌ Students API Error:', err);
      })
      .finally(() => setLoadingStudents(false))
  }, [user])

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

          {/* Stats & Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 28 }}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/staff/pending')}>
              <div className="stat-icon orange">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="17"/></svg>
              </div>
              <div className="stat-info">
                <h3>{loading ? '…' : pending.length}</h3>
                <p>Pending Reviews</p>
                <small style={{ color: 'var(--primary)', fontWeight: 600 }}>Click to view all →</small>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="stat-info">
                <h3>{loadingStudents ? '…' : students.length}</h3>
                <p>Total Students</p>
                <small style={{ color: 'var(--text-sub)' }}>{user?.classDepartment} • {user?.classYear}</small>
              </div>
            </div>
          </div>

          {/* Missing Config Warning */}
          {user?.assignedDepartment === 'class_teacher' && (!user?.classDepartment || !user?.classYear) && (
            <div className="card" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '20px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '50%' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>Matching Logic Not Configured</h4>
                <p style={{ margin: '4px 0 0', fontSize: '.85rem', opacity: 0.9 }}>You must set your <strong>Class Department</strong> and <strong>Class Year</strong> to see your students' requests. Currently, the system doesn't know which students belong to you.</p>
                <button className="btn btn-sm" style={{ marginTop: '10px', background: '#92400e', color: 'white', border: 'none' }} onClick={() => setShowProfileModal(true)}>Update My Class Profile</button>
              </div>
            </div>
          )}

          {/* Pending Requests List */}
          <div className="card" style={{padding:0, overflow:'hidden', marginBottom: 28}}>
            <div style={{padding:'18px 24px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 className="card-title" style={{margin:0}}>Recent Submissions (Requires Review)</h3>
              <Link to="/staff/pending" className="btn btn-primary btn-sm">View All Pending</Link>
            </div>
            {loading ? <div style={{padding:32,textAlign:'center',color:'var(--text-sub)'}}>Loading requests…</div>
            : pending.length === 0 ? (
              <div style={{padding:40, textAlign:'center'}}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>🎉</div>
                <p style={{color:'var(--success)', fontWeight:600, margin:0}}>No pending requests for your class.</p>
                <p style={{fontSize:'.85rem', color:'var(--text-sub)', marginTop:4}}>Students from {user?.classDepartment} - {user?.classYear} will appear here when they submit for approval.</p>
              </div>
            ) : (
              <div className="cr-list">
                {pending.slice(0,5).map(r => {
                  const stu = r.student || {}
                  return (
                    <div key={r._id} className="cr-item" onClick={() => navigate(`/staff/request/${r._id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, padding: '16px 24px', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      {/* Receipt Thumbnail */}
                      <div style={{ width: 60, height: 60, borderRadius: 8, background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        {r.receiptFile?.filename ? (
                          <img src={`${API_ROOT}/uploads/${r.receiptFile.filename}`} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8' }}>No Image</div>
                        )}
                      </div>
                      
                      {/* Student & Request Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{stu.fullName || 'Unknown Student'}</div>
                        <div style={{ fontSize: '.85rem', color: '#64748b', marginTop: 2 }}>
                          {stu.universityNumber} • <span style={{ textTransform: 'capitalize', color: 'var(--primary)', fontWeight: 600 }}>{r.ocrData?.particulars || r.feeType + ' Fee'}</span>
                        </div>
                      </div>

                      {/* OCR Extracted Amount */}
                      <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{r.ocrData?.amount || '₹—'}</div>
                        <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ''}</div>
                      </div>

                      {/* Action Button */}
                      <div className="btn btn-outline btn-sm" style={{ padding: '6px 12px' }}>Review →</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* My Students List */}
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div style={{padding:'18px 24px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h3 className="card-title" style={{margin:0}}>My Students ({user?.classDepartment} {user?.classYear})</h3>
              <span style={{fontSize:'.85rem', color:'var(--text-sub)'}}>{students.length} Total Registered</span>
            </div>
            
            <div className="table-wrap" style={{border:'none', borderRadius:0, boxShadow:'none'}}>
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Univ Number</th>
                    <th>Admission No</th>
                    <th>Clearance Status</th>
                    <th style={{textAlign: 'right'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:24}}>Loading students...</td></tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{textAlign:'center', padding:40, color:'var(--text-sub)'}}>
                        <p>No students found for <strong>{user?.classDepartment} - {user?.classYear}</strong>.</p>
                        <p style={{fontSize:'.8rem'}}>Verify that students have registered with these exact details.</p>
                      </td>
                    </tr>
                  ) : (
                    students.map(s => (
                      <tr key={s._id}>
                        <td><strong>{s.fullName}</strong></td>
                        <td style={{fontSize:'.85rem'}}>{s.universityNumber || '—'}</td>
                        <td style={{fontSize:'.85rem'}}>{s.admissionNumber || '—'}</td>
                        <td>
                           {/* We could fetch individual status here, but for now just show account status */}
                           <span className="badge badge-neutral">Registered</span>
                        </td>
                        <td style={{textAlign: 'right'}}>
                           <button className="btn btn-outline btn-sm" disabled>Profile</button>
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
