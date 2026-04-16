import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const pendingStudents = [
  { no: 1, name: 'Shiva Rama', id: 'CS2021001', prog: 'B.Tech CSE', sem: '6th', date: '07 Feb 2025', feeStatus: 'badge-success', feeLabel: 'Paid ✓', defaultRemark: 'Equipment damage fine ₹2,500 due' },
  { no: 2, name: 'Priya Nair', id: 'CS2021047', prog: 'B.Tech CSE', sem: '6th', date: '09 Feb 2025', feeStatus: 'badge-success', feeLabel: 'Paid ✓', defaultRemark: '' },
  { no: 3, name: 'Ravi Kumar', id: 'ME2021012', prog: 'B.Tech MECH', sem: '6th', date: '10 Feb 2025', feeStatus: 'badge-warning', feeLabel: 'Pending', defaultRemark: '' },
  { no: 4, name: 'Meena Devi', id: 'EE2021034', prog: 'B.Tech EEE', sem: '6th', date: '11 Feb 2025', feeStatus: 'badge-success', feeLabel: 'Paid ✓', defaultRemark: '' },
]

const recentActions = [
  { name: 'Arjun Menon', id: 'CS2021055', action: 'badge-success', actionLabel: '✔ Approved', remark: 'No dues found.', date: '14 Feb 2025' },
  { name: 'Lakshmi T.', id: 'CS2021019', action: 'badge-danger', actionLabel: '✖ Rejected', remark: 'Lab coat not returned.', date: '13 Feb 2025' },
  { name: 'Suresh K.', id: 'ME2021007', action: 'badge-success', actionLabel: '✔ Approved', remark: 'All clear.', date: '13 Feb 2025' },
]

function PendingRow({ student }) {
  const [remark, setRemark] = useState(student.defaultRemark)
  const [decision, setDecision] = useState(null)

  return (
    <tr>
      <td>{student.no}</td>
      <td style={{ fontWeight: 600 }}>{student.name}</td>
      <td><span className="badge badge-info">{student.id}</span></td>
      <td>{student.prog}</td>
      <td>{student.sem}</td>
      <td>{student.date}</td>
      <td><span className={`badge ${student.feeStatus}`}>{student.feeLabel}</span></td>
      <td>
        <input
          type="text"
          style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: '6px', fontSize: '.83rem', background: '#f8fafc' }}
          placeholder="Enter remarks..."
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
        />
      </td>
      <td>
        {decision ? (
          <span className={`badge ${decision === 'approved' ? 'badge-success' : 'badge-danger'}`}>
            {decision === 'approved' ? '✔ Approved' : '✖ Rejected'}
          </span>
        ) : (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="btn btn-success btn-sm" onClick={() => setDecision('approved')}>✔ Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => setDecision('rejected')}>✖ Reject</button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function StaffVerification() {
  const navigate = useNavigate()

  return (
    <div className="dashboard-body">
      {/* Simple sidebar for staff */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div className="logo-text"><span>CLEARTRACK</span><small>Staff Portal</small></div>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Staff Navigation</span>
          <a href="#" className="active">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            <span>Pending Verifications</span>
          </a>
          <a href="#">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span>Approved Students</span>
          </a>
          <span className="nav-section-label" style={{ marginTop: '16px' }}>Account</span>
          <a href="#" className="nav-logout" onClick={(e) => { e.preventDefault(); navigate('/login/teacher') }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">DR</div>
            <div className="user-info"><span>Dr. Anand R.</span><small>Lab Department</small></div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">Staff Verification Portal</div>
          <div className="topbar-right">
            <div className="topbar-badge">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="badge-dot"></span>
            </div>
            <div className="topbar-avatar">DR</div>
          </div>
        </header>

        <main className="page-content">
          <div className="page-header">
            <h1>✅ Student Clearance Verifications</h1>
            <p>Review, approve, or reject student clearance requests for your department.</p>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            {[
              { icon: '⏳', val: '4', label: 'Pending', sub: 'Awaiting review', color: 'orange' },
              { icon: '✅', val: '7', label: 'Approved Today', sub: 'This session', color: 'green' },
              { icon: '❌', val: '2', label: 'Rejected', sub: 'This month', color: 'red' },
              { icon: '📋', val: '48', label: 'Total Requests', sub: 'Semester 6', color: 'blue' },
            ].map((s) => (
              <div className="stat-card" key={s.label}>
                <div className={`stat-icon ${s.color}`}><span style={{ fontSize: '1.3rem' }}>{s.icon}</span></div>
                <div className="stat-info"><h3>{s.val}</h3><p>{s.label}</p></div>
              </div>
            ))}
          </div>

          {/* Pending Table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0, marginBottom: '28px' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div className="card-title" style={{ margin: 0 }}>⏳ Pending Clearance Requests</div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-sub)', marginTop: '2px' }}>Lab Department — Semester 6, 2024–25</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="🔍 Search student..." style={{ width: '200px', padding: '8px 12px', fontSize: '13px', border: '1.5px solid var(--border)', borderRadius: '8px', background: '#f8fafc', outline: 'none' }} />
                <button className="btn btn-outline btn-sm">Filter ▾</button>
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Student Name</th><th>Student ID</th><th>Programme</th><th>Semester</th><th>Applied On</th><th>Fee Status</th><th>Remarks</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pendingStudents.map((s) => <PendingRow key={s.no} student={s} />)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recently Actioned */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)' }}>
              <div className="card-title" style={{ margin: 0 }}>📋 Recently Actioned</div>
              <div style={{ fontSize: '.78rem', color: 'var(--text-sub)', marginTop: '2px' }}>Your recent decisions on clearance requests</div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
              <table>
                <thead><tr><th>Student</th><th>ID</th><th>Action</th><th>Remarks</th><th>Date</th></tr></thead>
                <tbody>
                  {recentActions.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td>{a.id}</td>
                      <td><span className={`badge ${a.action}`}>{a.actionLabel}</span></td>
                      <td style={{ fontSize: '13px', color: 'var(--text-sub)' }}>{a.remark}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-light)' }}>{a.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
