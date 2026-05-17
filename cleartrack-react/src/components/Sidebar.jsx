import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const configs = {
  student: {
    panel: 'Student Panel',
    avatar: 'R',
    name: 'Rajan Kumar',
    id: '24CSE0042',
    loginPath: '/login/student',
    nav: [
      { href: '#dashboard-section', label: 'Dashboard', icon: 'grid' },
      { href: '#clearance-req', label: 'Clearance Request', icon: 'file' },
      { href: '#clearance-status', label: 'Clearance Status', icon: 'check' },
    ],
  },
  teacher: {
    panel: 'Faculty Panel',
    avatar: 'P',
    name: 'Dr. Priya Sharma',
    id: 'TCH2024003',
    loginPath: '/login/teacher',
    nav: [
      { href: '#dashboard-top', label: 'Dashboard', icon: 'grid' },
      { href: '#student-table', label: 'Student List', icon: 'users' },
      { href: '#notifications', label: 'Notifications', icon: 'bell' },
    ],
  },
  admin: {
    panel: 'Admin Panel',
    avatar: 'A',
    name: 'Admin User',
    id: 'ADMIN001',
    loginPath: '/login/admin',
    nav: [
      { href: '#dashboard-top', label: 'Dashboard', icon: 'grid' },
      { href: '#fee-structure', label: 'Fee Structure', icon: 'file' },
      { href: '#users', label: 'Manage Users', icon: 'users' },
      { href: '#reports', label: 'Reports', icon: 'chart' },
    ],
  },
}

const icons = {
  grid: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  file: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  check: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  bell: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  chart: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  logout: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
}

export default function Sidebar({ role, activeSection }) {
  const cfg = configs[role] || configs.student
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  
  const displayName = user?.fullName || cfg.name
  const displayId = user?.universityNumber || user?.staffId || cfg.id
  const avatarChar = displayName.charAt(0).toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <div className="logo-text">
          <span>CLEARTRACK</span>
          <small>{cfg.panel}</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-section-label">Main Menu</span>
        {cfg.nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={activeSection === item.href ? 'active' : ''}
          >
            {icons[item.icon]}
            <span>{item.label}</span>
          </a>
        ))}
        <span className="nav-section-label" style={{ marginTop: '16px' }}>Account</span>
        <a
          href="#"
          className="nav-logout"
          onClick={(e) => { e.preventDefault(); navigate(cfg.loginPath) }}
        >
          {icons.logout}
          <span>Logout</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{avatarChar}</div>
          <div className="user-info">
            <span>{displayName}</span>
            <small>{displayId}</small>
          </div>
        </div>
      </div>
    </aside>
  )
}
