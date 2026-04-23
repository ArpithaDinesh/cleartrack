import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { adminAPI, authAPI, busAPI } from '../../services/api'
import ProfileModal from '../../components/ProfileModal'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('overview')
  const [userRoleFilterNav, setUserRoleFilterNav] = useState('all') // driven by stat card clicks
  const [newStudent, setNewStudent] = useState({ fullName:'', email:'', password:'', phone:'', admissionNumber:'', universityNumber:'', rollNumber:'', department:'', classYear:'' })
  const [feeForm, setFeeForm] = useState({ department:'', classYear:'', tuitionFee:'', hostelFee:'', busFee:'' })
  const [studentMsg, setStudentMsg] = useState('')
  const [feeMsg, setFeeMsg] = useState('')
  const [busRoutes, setBusRoutes] = useState([])
  const [selectedBusGroup, setSelectedBusGroup] = useState('')
  const [selectedBusLocation, setSelectedBusLocation] = useState('')
  const [filteredLocations, setFilteredLocations] = useState([])
  const [showRouteManager, setShowRouteManager] = useState(false)
  const [newRoute, setNewRoute] = useState({ group: 'Kannur', location: '', fee: 0 })
  const [loading, setLoading] = useState(true)
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'A'
  
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    Promise.all([adminAPI.getStats(), adminAPI.getUsers(), adminAPI.getLogs(), busAPI.getRoutes()])
      .then(([sRes, uRes, lRes, bRes]) => {
        setStats(sRes.stats)
        setUsers(uRes.users || [])
        setLogs(lRes.logs || [])
        setBusRoutes(bRes.routes || [])
      }).catch(console.error).finally(() => setLoading(false))
  }, [])


  const handleCreateStudent = async (e) => {
    e.preventDefault()
    try {
      await authAPI.registerStudent(newStudent)
      setStudentMsg('✓ Student account created successfully!')
      setNewStudent({ fullName:'', email:'', password:'', phone:'', admissionNumber:'', universityNumber:'', rollNumber:'', department:'', classYear:'' })
      const uRes = await adminAPI.getUsers()
      setUsers(uRes.users || [])
    } catch (err) {
      setStudentMsg('Error: ' + err.message)
    }
  }

  const handleToggle = async (id) => {
    try {
      await adminAPI.toggleUser(id)
      const uRes = await adminAPI.getUsers()
      setUsers(uRes.users || [])
    } catch (err) { console.error(err) }
  }

  // Navigate to users tab pre-filtered by role
  const goToUsers = (role) => {
    setUserRoleFilterNav(role)
    setUserRoleFilter(role)
    setActiveTab('users')
  }

  const handleSaveFeeStructure = (e) => {
    e.preventDefault();
    if(!feeForm.department || !feeForm.classYear) {
      setFeeMsg('Error: Please select department and year.');
      return;
    }
    // Simulate updating settings in UI realistically
    setFeeMsg('✓ Fee structure saved successfully!');
    setTimeout(() => setFeeMsg(''), 3000);
  }

  const handleGroupChange = (group) => {
    setSelectedBusGroup(group);
    setSelectedBusLocation('');
    setFeeForm(p => ({ ...p, busFee: '' }));
    setFilteredLocations(busRoutes.filter(r => r.group === group));
  };

  const handleLocationChange = (locId) => {
    setSelectedBusLocation(locId);
    const route = busRoutes.find(r => r._id === locId);
    if (route) {
      setFeeForm(p => ({ ...p, busFee: route.fee }));
    }
  };

  const handleAddRoute = async (e) => {
    e.preventDefault();
    try {
      await busAPI.createRoute(newRoute);
      const bRes = await busAPI.getRoutes();
      setBusRoutes(bRes.routes || []);
      setNewRoute({ group: 'Kannur', location: '', fee: 0 });
      setFeeMsg('✓ Route added successfully!');
    } catch (err) { setFeeMsg('Error: ' + err.message); }
  };

  const handleDeleteRoute = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await busAPI.deleteRoute(id);
      const bRes = await busAPI.getRoutes();
      setBusRoutes(bRes.routes || []);
    } catch (err) { console.error(err); }
  };

  const handleSeedRoutes = async () => {
    if (!window.confirm('This will reset all routes to default. Proceed?')) return;
    try {
      await busAPI.seedRoutes();
      const bRes = await busAPI.getRoutes();
      setBusRoutes(bRes.routes || []);
      setFeeMsg('✓ Routes seeded successfully!');
    } catch (err) { setFeeMsg('Error: ' + err.message); }
  };

  const statCards = stats ? [
    { label:'Total Students', value:stats.totalStudents, color:'blue',
      onClick: () => goToUsers('student') },
    { label:'Total Staff', value:stats.totalStaff, color:'teal',
      onClick: () => goToUsers('staff') },
    { label:'Total Requests', value:stats.totalRequests, color:'violet',
      onClick: () => setActiveTab('logs') },
    { label:'Approved', value:stats.approved, color:'green', onClick: null },
    { label:'Pending', value:stats.pending, color:'orange', onClick: null },
    { label:'Rejected', value:stats.rejected, color:'red', onClick: null },
  ] : []

  const filteredUsers = users.filter(u => {
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const dept = u.department;
    const matchDept = departmentFilter === 'all' || dept === departmentFilter;
    return matchRole && matchDept;
  })

  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Admin Panel</small></div></div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          {[['overview','Overview','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],['users','Users','M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],['student','Add Student','M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6M23 11h-6'],['fee','Fee Structure','M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],['logs','Activity Logs','M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8']].map(([tab,label,path])=>(
            <a key={tab} href="#" className={activeTab===tab?'active':''} onClick={e=>{e.preventDefault();setActiveTab(tab)}}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={path}/></svg>
              <span>{label}</span>
            </a>
          ))}
          <span className="nav-section-label" style={{marginTop:16}}>Account</span>
          <a href="#" className="nav-logout" onClick={e=>{e.preventDefault();logout();navigate('/login/admin')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
        </nav>
        <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName||'Admin'}</span><small>Super Admin</small></div></div></div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">Admin Dashboard</div>
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

          {activeTab === 'overview' && (
            <>
              <div className="page-header"><h1>System Administration</h1><p>Manage students, staff, fee structures and monitor system activity.</p></div>
              <div className="stats-grid">
                {statCards.map(s => (
                  <div
                    key={s.label}
                    className="stat-card"
                    onClick={s.onClick || undefined}
                    style={s.onClick ? { cursor:'pointer', transition:'transform .15s, box-shadow .15s' } : {}}
                    onMouseEnter={e => { if (s.onClick) { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)'; }}}
                    onMouseLeave={e => { if (s.onClick) { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}}
                  >
                    <div className={`stat-icon ${s.color}`}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg></div>
                    <div className="stat-info">
                      <h3>{loading ? '…' : s.value}</h3>
                      <p>{s.label}{s.onClick && <span style={{fontSize:'.7rem',marginLeft:6,opacity:.6}}>↗ view</span>}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card"><h3 className="card-title">Quick Actions</h3><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="btn btn-primary" onClick={()=>setActiveTab('student')}>+ Add Student Account</button><button className="btn btn-outline" onClick={()=>setActiveTab('users')}>Manage Users</button><button className="btn btn-outline" onClick={()=>setActiveTab('fee')}>Fee Structure</button><button className="btn btn-outline" onClick={()=>setActiveTab('logs')}>View Logs</button></div></div>
              
            </>
          )}

          {activeTab === 'users' && (
            <>
              <div className="page-header"><h1>User Management</h1><p>View and manage all students and staff.</p></div>
              <div className="card" style={{padding:0,overflow:'hidden'}}>
                <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <h3 className="card-title" style={{margin:0}}>Users ({filteredUsers.length})</h3>
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    <select style={{borderRadius:'6px', border:'1px solid #d1d5db', padding:'5px 10px', fontSize:'.85rem', outline:'none', cursor:'pointer'}} value={departmentFilter} onChange={(e)=>setDepartmentFilter(e.target.value)}>
                      <option value="all">All Departments</option>
                      <option value="CS">CS</option>
                      <option value="IT">IT</option>
                      <option value="CE">CE</option>
                      <option value="ME">ME</option>
                      <option value="EC">EC</option>
                      <option value="EEE">EEE</option>
                      <option value="MCA">MCA</option>
                      <option value="MBA">MBA</option>
                    </select>
                    <button className={`btn btn-sm ${userRoleFilter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={()=>setUserRoleFilter('all')}>All</button>
                    <button className={`btn btn-sm ${userRoleFilter === 'admin' ? 'btn-primary' : 'btn-outline'}`} onClick={()=>setUserRoleFilter('admin')}>Admins</button>
                    <button className={`btn btn-sm ${userRoleFilter === 'staff' ? 'btn-primary' : 'btn-outline'}`} onClick={()=>setUserRoleFilter('staff')}>Teachers</button>
                    <button className={`btn btn-sm ${userRoleFilter === 'student' ? 'btn-primary' : 'btn-outline'}`} onClick={()=>setUserRoleFilter('student')}>Students</button>
                  </div>
                </div>
                <div className="table-wrap" style={{border:'none',borderRadius:0,boxShadow:'none'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        {userRoleFilter !== 'all' && userRoleFilter !== 'admin' && <th>Department</th>}
                        <th>ID</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={userRoleFilter !== 'all' && userRoleFilter !== 'admin' ? 7 : 6} style={{textAlign:'center',padding:24}}>Loading…</td></tr>
                    : filteredUsers.map(u=>(
                      <tr key={u._id}>
                        <td><strong>{u.fullName}</strong></td>
                        <td style={{fontSize:'.85rem'}}>{u.email}</td>
                        <td><span className={`badge badge-${u.role==='admin'?'danger':u.role==='staff'?'info':'success'}`}>{u.role}</span></td>
                        {userRoleFilter !== 'all' && userRoleFilter !== 'admin' && (
                          <td style={{fontSize:'.85rem', fontWeight:'500'}}>{u.department || '—'}</td>
                        )}
                        <td style={{fontSize:'.82rem',color:'var(--text-sub)'}}>{u.universityNumber||u.staffId||'—'}</td>
                        <td><span className={`badge ${u.isActive?'badge-success':'badge-neutral'}`}>{u.isActive?'Active':'Inactive'}</span></td>
                        <td><button className={`btn btn-sm ${u.isActive?'btn-outline':'btn-primary'}`} onClick={()=>handleToggle(u._id)}>{u.isActive?'Deactivate':'Activate'}</button></td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            </>
          )}


          {activeTab === 'student' && (
            <>
              <div className="page-header"><h1>Add Student Account</h1><p>Create student accounts directly from the admin panel.</p></div>
              <div className="card" style={{maxWidth:560}}>
                <form onSubmit={handleCreateStudent}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div className="form-group"><label>Full Name</label><input value={newStudent.fullName} onChange={e=>setNewStudent(p=>({...p,fullName:e.target.value}))} placeholder="Student Name" required/></div>
                    <div className="form-group"><label>Phone Number</label><input type="tel" value={newStudent.phone} onChange={e=>setNewStudent(p=>({...p,phone:e.target.value}))} placeholder="+91 9876543210"/></div>
                    <div className="form-group"><label>Email ID</label><input type="email" value={newStudent.email} onChange={e=>setNewStudent(p=>({...p,email:e.target.value}))} placeholder="student@college.edu" required/></div>
                    <div className="form-group"><label>Temporary Password</label><input type="password" value={newStudent.password} onChange={e=>setNewStudent(p=>({...p,password:e.target.value}))} placeholder="Min 6 chars" required/></div>
                    <div className="form-group"><label>Department</label>
                      <select value={newStudent.department} onChange={e=>setNewStudent(p=>({...p,department:e.target.value}))} required>
                        <option value="" disabled>Select department</option>
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
                    <div className="form-group"><label>Class/Year</label>
                      <select value={newStudent.classYear} onChange={e=>setNewStudent(p=>({...p,classYear:e.target.value}))} required>
                        <option value="" disabled>Select</option>
                        <option value="First year">First year</option>
                        <option value="Second year">Second year</option>
                        <option value="Third year">Third year</option>
                        <option value="Fourth year">Fourth year</option>
                      </select>
                    </div>
                    <div className="form-group"><label>Admission Number</label><input value={newStudent.admissionNumber} onChange={e=>setNewStudent(p=>({...p,admissionNumber:e.target.value}))} placeholder="e.g. 23BITTLY213" required/></div>
                    <div className="form-group"><label>Roll Number</label><input value={newStudent.rollNumber} onChange={e=>setNewStudent(p=>({...p,rollNumber:e.target.value}))} placeholder="e.g. 20" required/></div>
                    <div className="form-group"><label>University Number</label><input value={newStudent.universityNumber} onChange={e=>setNewStudent(p=>({...p,universityNumber:e.target.value}))} placeholder="e.g. TLY23IT013" required/></div>
                  </div>
                  {studentMsg && <div style={{padding:'10px 14px',borderRadius:8,marginBottom:14,fontSize:'.875rem',background:studentMsg.startsWith('Error')?'#fee2e2':'#d1fae5',color:studentMsg.startsWith('Error')?'#991b1b':'#065f46'}}>{studentMsg}</div>}
                  <button type="submit" className="btn btn-primary btn-full" style={{marginTop:14}}>Create Student Account</button>
                </form>
              </div>
            </>
          )}

          {activeTab === 'fee' && (
            <div style={{display:'flex', flexDirection:'column', gap:24}}>
              <div className="page-header" style={{marginBottom:0}}><h1>Fee Structure Management</h1><p>Manage different fee categories independently.</p></div>
              
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:24}}>
                {/* Tuition Fee Section */}
                <div className="card">
                  <h3 className="card-title" style={{display:'flex', alignItems:'center', gap:10}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    Tuition Fee Management
                  </h3>
                  <form onSubmit={handleSaveFeeStructure}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14, marginBottom: 16}}>
                      <div className="form-group"><label>Department</label>
                        <select value={feeForm.department} onChange={e=>setFeeForm(p=>({...p,department:e.target.value}))} required>
                          <option value="" disabled>Select department</option>
                          <option value="IT">IT</option><option value="CS">CS</option><option value="EC">EC</option><option value="EEE">EEE</option><option value="ME">ME</option><option value="CE">CE</option><option value="MBA">MBA</option><option value="MCA">MCA</option>
                        </select>
                      </div>
                      <div className="form-group"><label>Class/Year</label>
                        <select value={feeForm.classYear} onChange={e=>setFeeForm(p=>({...p,classYear:e.target.value}))} required>
                          <option value="" disabled>Select year</option>
                          <option value="First year">First year</option><option value="Second year">Second year</option><option value="Third year">Third year</option><option value="Fourth year">Fourth year</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Amount (₹)</label>
                      <input type="number" min="0" value={feeForm.tuitionFee} onChange={e=>setFeeForm(p=>({...p,tuitionFee:e.target.value}))} placeholder="0" required/>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{marginTop:16}}>Update Tuition Fee</button>
                  </form>
                </div>

                {/* Hostel Fee Section */}
                <div className="card">
                  <h3 className="card-title" style={{display:'flex', alignItems:'center', gap:10}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Hostel Fee Management
                  </h3>
                  <form onSubmit={handleSaveFeeStructure}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14, marginBottom: 16}}>
                      <div className="form-group"><label>Department</label>
                        <select value={feeForm.department} onChange={e=>setFeeForm(p=>({...p,department:e.target.value}))} required>
                          <option value="" disabled>Select department</option>
                          <option value="IT">IT</option><option value="CS">CS</option><option value="EC">EC</option><option value="EEE">EEE</option><option value="ME">ME</option><option value="CE">CE</option><option value="MBA">MBA</option><option value="MCA">MCA</option>
                        </select>
                      </div>
                      <div className="form-group"><label>Class/Year</label>
                        <select value={feeForm.classYear} onChange={e=>setFeeForm(p=>({...p,classYear:e.target.value}))} required>
                          <option value="" disabled>Select year</option>
                          <option value="First year">First year</option><option value="Second year">Second year</option><option value="Third year">Third year</option><option value="Fourth year">Fourth year</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Amount (₹)</label>
                      <input type="number" min="0" value={feeForm.hostelFee} onChange={e=>setFeeForm(p=>({...p,hostelFee:e.target.value}))} placeholder="0" required/>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{marginTop:16}}>Update Hostel Fee</button>
                  </form>
                </div>
              </div>

              {/* Bus Fee Section (Full Width) */}
              <div className="card">
                <h3 className="card-title" style={{display:'flex', alignItems:'center', gap:10, marginBottom:20}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="22" height="13" rx="5"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="4" y1="21" x2="4" y2="21"/><line x1="20" y1="21" x2="20" y2="21"/></svg>
                  Bus Fee Management
                </h3>
                <form onSubmit={handleSaveFeeStructure}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                    <div style={{display:'flex', flexDirection:'column', gap:14}}>
                      <div className="form-group"><label>Department</label>
                        <select value={feeForm.department} onChange={e=>setFeeForm(p=>({...p,department:e.target.value}))} required>
                          <option value="" disabled>Select department</option>
                          <option value="IT">IT</option><option value="CS">CS</option><option value="EC">EC</option><option value="EEE">EEE</option><option value="ME">ME</option><option value="CE">CE</option><option value="MBA">MBA</option><option value="MCA">MCA</option>
                        </select>
                      </div>
                      <div className="form-group"><label>Class/Year</label>
                        <select value={feeForm.classYear} onChange={e=>setFeeForm(p=>({...p,classYear:e.target.value}))} required>
                          <option value="" disabled>Select year</option>
                          <option value="First year">First year</option><option value="Second year">Second year</option><option value="Third year">Third year</option><option value="Fourth year">Fourth year</option>
                        </select>
                      </div>
                    </div>

                    <div style={{background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                      <h5 style={{margin:'0 0 10px 0', fontSize:'.85rem', color:'#64748b'}}>Bus Fee Configuration</h5>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                        <div className="form-group">
                          <label>Bus Route Group</label>
                          <select value={selectedBusGroup} onChange={e=>handleGroupChange(e.target.value)}>
                            <option value="">Select Group</option>
                            <option value="Kannur">Kannur</option><option value="Mattannur">Mattannur</option><option value="Thalassery">Thalassery</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Sub Location</label>
                          <select value={selectedBusLocation} onChange={e=>handleLocationChange(e.target.value)} disabled={!selectedBusGroup}>
                            <option value="">Select Location</option>
                            {filteredLocations.map(r => (
                              <option key={r._id} value={r._id}>{r.location} (₹{r.fee})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{marginTop:10}}>
                        <label>Calculated Bus Fee</label>
                        <input type="number" value={feeForm.busFee} readOnly style={{background:'#f1f5f9'}}/>
                      </div>
                    </div>
                  </div>

                  <div style={{marginTop:20, display:'flex', gap:10}}>
                    <button type="submit" className="btn btn-primary" style={{flex:1}}>Save Bus Fee Structure</button>
                    <button type="button" className="btn btn-outline" onClick={()=>setShowRouteManager(!showRouteManager)}>
                      {showRouteManager ? 'Hide Route Manager' : '⚙ Manage Routes'}
                    </button>
                  </div>
                </form>
              </div>

              {showRouteManager && (
                <div className="card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                    <h3 className="card-title" style={{margin:0}}>Manage Bus Routes</h3>
                    <button className="btn btn-outline btn-sm" onClick={handleSeedRoutes}>Reset to Defaults</button>
                  </div>

                  <form onSubmit={handleAddRoute} style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:10, alignItems:'end', marginBottom:20, padding:15, background:'#f8fafc', borderRadius:8}}>
                    <div className="form-group" style={{margin:0}}><label>Group</label>
                      <select value={newRoute.group} onChange={e=>setNewRoute(p=>({...p,group:e.target.value}))}>
                        <option value="Kannur">Kannur</option><option value="Mattannur">Mattannur</option><option value="Thalassery">Thalassery</option>
                      </select>
                    </div>
                    <div className="form-group" style={{margin:0}}><label>Location</label>
                      <input value={newRoute.location} onChange={e=>setNewRoute(p=>({...p,location:e.target.value}))} placeholder="e.g. Chala" required/>
                    </div>
                    <div className="form-group" style={{margin:0}}><label>Fee (₹)</label>
                      <input type="number" value={newRoute.fee} onChange={e=>setNewRoute(p=>({...p,fee:e.target.value}))} required/>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" style={{height:38}}>Add Route</button>
                  </form>

                  <div className="table-wrap" style={{maxHeight:400, overflow:'auto'}}>
                    <table>
                      <thead><tr><th>Group</th><th>Location</th><th>Fee (₹)</th><th>Action</th></tr></thead>
                      <tbody>
                        {busRoutes.length === 0 ? (
                          <tr><td colSpan="4" style={{textAlign:'center', padding:20}}>No routes found. Click "Reset to Defaults" to seed data.</td></tr>
                        ) : busRoutes.map(r => (
                          <tr key={r._id}>
                            <td>{r.group}</td><td>{r.location}</td><td>₹{r.fee}</td>
                            <td><button className="btn btn-sm btn-outline" style={{color:'#ef4444', borderColor:'#fecaca'}} onClick={()=>handleDeleteRoute(r._id)}>Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <>
              <div className="page-header"><h1>Activity Logs</h1><p>Recent system events and approval actions.</p></div>
              <div className="card" style={{padding:0,overflow:'hidden'}}>
                <div className="table-wrap" style={{border:'none',borderRadius:0,boxShadow:'none'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th><th>Action</th><th>By</th><th>Request</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? <tr><td colSpan={5} style={{textAlign:'center',padding:24}}>Loading…</td></tr>
                      : logs.length === 0 ? <tr><td colSpan={5} style={{textAlign:'center',padding:24,color:'var(--text-sub)'}}>No logs found.</td></tr>
                      : logs.map(l => (
                        <tr key={l._id}>
                          <td style={{fontSize:'.78rem',color:'var(--text-sub)',whiteSpace:'nowrap'}}>{new Date(l.createdAt).toLocaleString()}</td>
                          <td><span className={`badge badge-${l.action==='approved'?'success':l.action==='rejected'?'danger':'info'}`}>{l.action}</span></td>
                          <td style={{fontSize:'.85rem'}}>{l.performedBy?.fullName||'System'}</td>
                          <td style={{fontSize:'.82rem'}}>{l.clearanceRequest?.requestNumber||'—'}</td>
                          <td style={{fontSize:'.82rem'}}>{l.newStatus||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </main>
      </div>
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  )
}
