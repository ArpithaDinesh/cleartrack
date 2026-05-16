import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI, API_ROOT } from '../../services/api'

export default function RequestDetail() {
  const { user, logout } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [req, setReq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [remarks, setRemarks] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [decision, setDecision] = useState(null)
  const [error, setError] = useState('')
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'T'

  useEffect(() => {
    clearanceAPI.getRequest(id)
      .then(d => setReq(d.request))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleDecision = async (dec) => {
    setDeciding(true); setError('')
    try {
      const d = await clearanceAPI.reviewRequest(id, dec, remarks)
      setReq(d.request)
      setDecision(dec)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeciding(false)
    }
  }

  const myApproval = req?.departmentApprovals?.find(a => a.department === user?.assignedDepartment)
  const stu = req?.student || {}

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
        <header className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>navigate('/staff/pending')} className="btn btn-outline btn-sm">← Back</button>
            <div className="topbar-title">Request Detail</div>
          </div>
          <div className="topbar-right"><div className="topbar-avatar">{initials}</div></div>
        </header>
        <main className="page-content">
          {loading ? <div className="card" style={{textAlign:'center',padding:40}}><p style={{color:'var(--text-sub)'}}>Loading…</p></div>
          : error && !req ? <div className="card" style={{textAlign:'center',padding:40}}><p style={{color:'var(--danger)'}}>{error}</p></div>
          : req && (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start'}}>
                <div style={{display:'flex', flexDirection:'column', gap:24}}>
                  {/* Student Info */}
                  <div className="card">
                    <h3 className="card-title">Student Information</h3>
                    <div style={{display:'flex', flexDirection:'column', gap:12}}>
                      <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', paddingBottom:10}}>
                        <span style={{color:'var(--text-sub)', fontSize:'.85rem'}}>Full Name</span>
                        <span style={{fontWeight:600}}>{stu.fullName}</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', paddingBottom:10}}>
                        <span style={{color:'var(--text-sub)', fontSize:'.85rem'}}>University Number</span>
                        <span style={{fontWeight:600}}>{stu.universityNumber}</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #f1f5f9', paddingBottom:10}}>
                        <span style={{color:'var(--text-sub)', fontSize:'.85rem'}}>Department / Year</span>
                        <span>{stu.department} — Year {stu.classYear}</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span style={{color:'var(--text-sub)', fontSize:'.85rem'}}>Fee Type</span>
                        <span style={{textTransform:'capitalize', fontWeight:500, color:'var(--primary)'}}>{req.feeType} Fee</span>
                      </div>
                    </div>
                  </div>

                  {/* OCR Extracted Data */}
                  <div className="card">
                    <h3 className="card-title">Extracted Payment Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: 20 }}>
                      {[
                        { label: 'Student Name', value: req.ocrData?.name || '—' },
                        { label: 'Department', value: req.ocrData?.department || '—' },
                        { label: 'Particulars', value: req.ocrData?.particulars || '—', bold: true },
                        { label: 'Amount Paid', value: req.ocrData?.amount || '—', bold: true },
                        { label: 'Bank Name', value: req.ocrData?.bank || '—' },
                        { label: 'Payment Date', value: req.ocrData?.date || '—' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <label style={{ fontSize: '.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{item.label}</label>
                          <span style={{ fontWeight: item.bold ? 700 : 500, color: item.bold ? 'var(--primary)' : '#334155', fontSize: '1.05rem' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <h3 className="card-title" style={{ fontSize: '.9rem', marginBottom: 10 }}>Raw Extraction Text</h3>
                    <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        fontSize: '.75rem',
                        lineHeight: 1.5,
                        color: '#475569',
                        fontFamily: 'monospace',
                        maxHeight: '150px',
                        overflowY: 'auto'
                      }}>
                        {req.ocrData?.rawText || 'No raw text available.'}
                      </pre>
                    </div>
                  </div>
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:24}}>
                  {/* Receipt View */}
                  <div className="card" style={{padding:0, overflow:'hidden'}}>
                    <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <h3 className="card-title" style={{margin:0}}>Uploaded Receipt</h3>
                      <a href={`${API_ROOT}/uploads/${req.receiptFile?.filename}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">Full Resolution</a>
                    </div>
                    <div style={{background:'#f1f5f9', padding:10, textAlign:'center'}}>
                      <img 
                        src={`${API_ROOT}/uploads/${req.receiptFile?.filename}`} 
                        alt="Receipt" 
                        style={{maxWidth:'100%', borderRadius:4, boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}} 
                      />
                    </div>
                  </div>

                  {/* Decision Panel */}
                  <div className="card" style={{borderLeft:'4px solid var(--primary)'}}>
                    <h3 className="card-title">Review Decision</h3>
                    {myApproval?.status === 'pending' && !decision ? (
                      <>
                        <div className="form-group">
                          <label>Remarks (optional)</label>
                          <textarea rows={2} value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Add any remarks…" style={{width:'100%',padding:'10px 14px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',fontFamily:'inherit',fontSize:'.9rem',resize:'vertical'}}/>
                        </div>
                        {error && <div style={{background:'#fee2e2',color:'#991b1b',padding:'10px 14px',borderRadius:8,marginBottom:12,fontSize:'.875rem'}}>{error}</div>}
                        <div style={{display:'flex',gap:12}}>
                          <button className="btn-approve" onClick={()=>handleDecision('approved')} disabled={deciding}>
                            <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            {deciding ? 'Processing…' : 'Approve'}
                          </button>
                          <button className="btn-reject" onClick={()=>handleDecision('rejected')} disabled={deciding}>
                            <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            {deciding ? 'Processing…' : 'Reject'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className={`cr-decision ${myApproval?.status}`} style={{display:'flex'}}>
                        {myApproval?.status === 'approved' ? '✓ You approved this request' : myApproval?.status === 'rejected' ? '✗ You rejected this request' : myApproval?.status === 'not_applicable' ? 'N/A — This department is not required' : 'No action needed'}
                        {decision && <span style={{marginLeft:8,fontWeight:400}}>{remarks && `— "${remarks}"`}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
