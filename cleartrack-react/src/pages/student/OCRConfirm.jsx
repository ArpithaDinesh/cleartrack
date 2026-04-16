import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ocrAPI } from '../../services/api'

export default function OCRConfirm() {
  const { user, logout } = useAuth()
  const { requestId } = useParams()
  const navigate = useNavigate()
  const [ocr, setOcr] = useState({ transactionId:'', amount:'', paymentDate:'', receiptNumber:'', bankName:'', paymentMode:'' })
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'S'

  useEffect(() => {
    ocrAPI.processOCR(requestId)
      .then(data => {
        setOcr({ transactionId:data.ocrData.transactionId||'', amount:data.ocrData.amount||'', paymentDate:data.ocrData.paymentDate||'', receiptNumber:data.ocrData.receiptNumber||'', bankName:data.ocrData.bankName||'', paymentMode:data.ocrData.paymentMode||'' })
        setRawText(data.ocrData.rawText || '')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [requestId])

  const handleConfirm = async (e) => {
    e.preventDefault()
    setConfirming(true)
    try {
      await ocrAPI.confirmOCR(requestId, ocr)
      navigate('/clearance-status')
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  const Field = ({ label, field }) => (
    <div className="form-group">
      <label>{label}</label>
      <input type="text" value={ocr[field]} onChange={e=>setOcr(p=>({...p,[field]:e.target.value}))} placeholder={`Enter ${label}`}/>
    </div>
  )

  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Student Panel</small></div></div>
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          <Link to="/dashboard/student"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Dashboard</span></Link>
          <Link to="/upload-receipt"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload Receipt</span></Link>
          <Link to="/clearance-status"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Clearance Status</span></Link>
          <Link to="/request-history"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Request History</span></Link>
          <span className="nav-section-label" style={{marginTop:16}}>Account</span>
          <a href="#" className="nav-logout" onClick={(e)=>{e.preventDefault();logout();navigate('/login/student')}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Logout</span></a>
        </nav>
        <div className="sidebar-footer"><div className="sidebar-user"><div className="avatar">{initials}</div><div className="user-info"><span>{user?.fullName}</span><small>{user?.universityNumber}</small></div></div></div>
      </aside>

      <div className="main-content">
        <header className="topbar"><div className="topbar-title">OCR Confirmation</div><div className="topbar-right"><div className="topbar-avatar">{initials}</div></div></header>
        <main className="page-content">
          <div className="page-header"><h1>Confirm OCR Data</h1><p>Review the automatically extracted data. You can edit any incorrect fields before confirming.</p></div>

          {loading ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <div style={{width:48,height:48,border:'4px solid #e2e8f0',borderTopColor:'var(--primary)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
              <p style={{color:'var(--text-sub)'}}>Running OCR analysis on your receipt…</p>
            </div>
          ) : error ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <p style={{color:'var(--danger)',marginBottom:16}}>{error}</p>
              <Link to="/upload-receipt" className="btn btn-primary">Try Again</Link>
            </div>
          ) : (
            <form onSubmit={handleConfirm}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,alignItems:'start'}}>
                <div className="card">
                  <h3 className="card-title" style={{marginBottom:20}}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    OCR Extracted Fields
                  </h3>
                  <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'8px 12px',marginBottom:16,fontSize:'.78rem',color:'#92400e'}}>
                    ⚠ OCR values may not be 100% accurate. Please verify and correct before confirming.
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <Field label="Transaction ID" field="transactionId"/>
                    <Field label="Amount Paid" field="amount"/>
                    <Field label="Payment Date" field="paymentDate"/>
                    <Field label="Receipt No." field="receiptNumber"/>
                    <Field label="Bank Name" field="bankName"/>
                    <Field label="Payment Mode" field="paymentMode"/>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title" style={{marginBottom:16,fontSize:'.875rem'}}>Raw OCR Text</h3>
                  <pre style={{background:'#f8fafc',border:'1px solid var(--border)',borderRadius:8,padding:14,fontSize:'.72rem',lineHeight:1.8,whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:280,overflowY:'auto',color:'var(--text-sub)',fontFamily:'monospace'}}>{rawText || 'No raw text extracted'}</pre>
                </div>
              </div>

              {error && <div style={{background:'#fee2e2',border:'1px solid #fca5a5',color:'#991b1b',padding:'12px 16px',borderRadius:8,margin:'16px 0',fontSize:'.875rem'}}>{error}</div>}

              <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:20}}>
                <Link to="/upload-receipt" className="btn btn-outline">← Re-upload</Link>
                <button type="submit" className="btn btn-primary" disabled={confirming}>
                  {confirming ? 'Confirming…' : '✓ Confirm & Submit Request'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}
