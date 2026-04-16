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
              {/* Student Info */}
              <div className="card" style={{marginBottom:20}}>
                <h3 className="card-title">Student Information</h3>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
                  {[['Name',stu.fullName],['Univ. No.',stu.universityNumber],['Roll No.',stu.rollNumber],['Department',stu.department],['Year',stu.classYear]].map(([l,v])=>(
                    <div key={l} className="cf-field"><label>{l}</label><span>{v||'—'}</span></div>
                  ))}
                </div>
              </div>

              {/* OCR Data */}
              {req.ocrData && (
                <div className="card" style={{marginBottom:20}}>
                  <h3 className="card-title">OCR Extracted Payment Data</h3>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
                    {[['Transaction ID',req.ocrData.transactionId],['Amount',req.ocrData.amount],['Payment Date',req.ocrData.paymentDate],['Receipt No.',req.ocrData.receiptNumber],['Bank',req.ocrData.bankName],['Mode',req.ocrData.paymentMode]].map(([l,v])=> v ? (
                      <div key={l} className="cr-ocr-field"><label>{l}</label><span>{v}</span></div>
                    ) : null)}
                  </div>
                  {req.ocrData.rawText && (
                    <details style={{marginTop:14}}>
                      <summary style={{cursor:'pointer',fontSize:'.8rem',color:'var(--text-sub)'}}>View raw OCR text</summary>
                      <pre style={{background:'#f8fafc',padding:12,borderRadius:8,fontSize:'.72rem',marginTop:8,whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:180,overflowY:'auto'}}>{req.ocrData.rawText}</pre>
                    </details>
                  )}
                </div>
              )}

              {/* Receipt file */}
              {req.receiptFile && (
                <div className="card" style={{marginBottom:20}}>
                  <h3 className="card-title">Uploaded Receipt</h3>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div className="cr-receipt-thumb" style={{width:80,aspectRatio:'3/4'}}>
                      <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <p style={{fontWeight:600,color:'var(--text-main)',marginBottom:4}}>{req.receiptFile.originalName}</p>
                      <p style={{fontSize:'.78rem',color:'var(--text-sub)'}}>{(req.receiptFile.size/1024/1024).toFixed(2)} MB</p>
                      <a href={`${API_ROOT}/uploads/${req.receiptFile.filename}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{marginTop:8}}>👁 View Receipt</a>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Panel */}
              <div className="card">
                <h3 className="card-title">Your Department Decision</h3>
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
            </>
          )}
        </main>
      </div>
    </div>
  )
}
