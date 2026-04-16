import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI } from '../../services/api'

export default function UploadReceipt() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()
  const [file, setFile] = useState(null)
  const [feeType, setFeeType] = useState('tuition')
  const [semester, setSemester] = useState('')
  const [academicYear, setAcademicYear] = useState('2025-26')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const onFile = (f) => {
    if (f && f.size <= 10 * 1024 * 1024) setFile(f)
    else setError('File too large. Maximum size is 10 MB.')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return setError('Please select a receipt file.')
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('receipt', file)
      fd.append('feeType', feeType)
      fd.append('semester', semester)
      fd.append('academicYear', academicYear)
      fd.append('studentNotes', notes)
      const { request } = await clearanceAPI.submitRequest(fd)
      navigate(`/ocr-confirm/${request._id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'S'

  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <div className="logo-text"><span>CLEARTRACK</span><small>Student Panel</small></div>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          <Link to="/dashboard/student"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Dashboard</span></Link>
          <Link to="/upload-receipt" className="active"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload Receipt</span></Link>
          <Link to="/clearance-status"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Clearance Status</span></Link>
          <Link to="/request-history"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Request History</span></Link>
          <span className="nav-section-label" style={{marginTop:16}}>Account</span>
          <a href="#" className="nav-logout" onClick={(e)=>{e.preventDefault();logout();navigate('/login/student')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
        </nav>
        <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName}</span><small>{user?.universityNumber}</small></div></div></div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">Upload Fee Receipt</div>
          <div className="topbar-right"><div className="topbar-avatar">{initials}</div></div>
        </header>
        <main className="page-content">
          <div className="page-header"><h1>Upload Receipt</h1><p>Upload your fee receipt to begin the OCR-based clearance process.</p></div>

          <form onSubmit={handleSubmit} style={{maxWidth:720}}>
            <div className="card" style={{marginBottom:24}}>
              <h3 className="card-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Fee Details</h3>

              <div className="form-group">
                <label className="field-label">Fee Type</label>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {[['tuition','Tuition Fee'],['bus','Bus Fee'],['hostel','Hostel Fee'],['exam','Exam Fee'],['full','All Fees']].map(([val,label])=>(
                    <label key={val} className="radio-opt" style={{border:`1.5px solid ${feeType===val?'var(--primary)':'var(--border)'}`,background:feeType===val?'rgba(37,99,235,.07)':'',color:feeType===val?'var(--primary)':'var(--text-sub)'}}>
                      <input type="radio" name="feeType" value={val} checked={feeType===val} onChange={()=>setFeeType(val)} style={{display:'none'}}/>{label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div className="form-group">
                  <label>Semester</label>
                  <select value={semester} onChange={e=>setSemester(e.target.value)} required>
                    <option value="" disabled>Select Semester</option>
                    {['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7','Sem 8'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Academic Year</label>
                  <select value={academicYear} onChange={e=>setAcademicYear(e.target.value)}>
                    {['2023-24','2024-25','2025-26','2026-27'].map(y=><option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{marginBottom:24}}>
              <h3 className="card-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Receipt Upload</h3>

              <label
                htmlFor="receipt-file"
                className="upload-zone"
                style={{border:`2.5px dashed ${dragOver?'var(--primary)':'var(--border)'}`,background:dragOver?'rgba(37,99,235,.04)':'#f8fafc',cursor:'pointer',borderRadius:'var(--radius-sm)',padding:'32px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,transition:'all 0.2s'}}
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={handleDrop}
              >
                <div style={{width:52,height:52,background:'#dbeafe',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                {file
                  ? <><strong style={{color:'var(--primary)'}}>{file.name}</strong><span style={{fontSize:'.78rem',color:'var(--text-sub)'}}>({(file.size/1024/1024).toFixed(2)} MB)</span></>
                  : <><strong style={{color:'var(--text-main)'}}>Click to upload or drag & drop</strong><span style={{fontSize:'.78rem',color:'var(--text-sub)'}}>JPG, PNG, PDF — max 10 MB</span></>
                }
                <input id="receipt-file" type="file" accept="image/*,.pdf" style={{display:'none'}} ref={fileRef} onChange={e=>onFile(e.target.files[0])}/>
              </label>

              <div className="form-group" style={{marginTop:16}}>
                <label>Additional Notes (optional)</label>
                <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any remarks about this receipt…" style={{width:'100%',padding:'10px 14px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',resize:'vertical',fontFamily:'inherit',fontSize:'.9rem'}}/>
              </div>
            </div>

            {error && <div style={{background:'#fee2e2',border:'1px solid #fca5a5',color:'#991b1b',padding:'12px 16px',borderRadius:8,marginBottom:16,fontSize:'.875rem'}}>{error}</div>}

            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <Link to="/dashboard/student" className="btn btn-outline">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Uploading…' : '➜ Upload & Process OCR'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}
