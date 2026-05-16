import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ocrAPI, clearanceAPI, API_ROOT } from '../../services/api'

export default function OCRConfirm() {
  const { user, logout } = useAuth()
  const { requestId } = useParams()
  const navigate = useNavigate()
  const [ocr, setOcr] = useState({
    name:'', department:'', particulars:'',
    amount:'', bank:''
  })
  const [rawText, setRawText] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [error, setError] = useState('')
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'S'

  const applyOcrData = (d, rt, rUrl) => {
    setOcr({
      name:        d.name        || '',
      department:   d.department   || '',
      particulars:  d.particulars  || '',
      amount:       d.amount       || '',
      bank:         d.bank         || '',
    })
    setRawText(rt || d.rawText || '')
    setReceiptUrl(rUrl || '')
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await clearanceAPI.getRequest(requestId);
        const req = data.request || {};
        const d = req.ocrData || {};
        
        const imgUrl = req.receiptFile?.filename ? `${API_ROOT}/uploads/${req.receiptFile.filename}` : '';

        if (d.ocrStatus === 'completed') {
          applyOcrData(d, d.rawText, imgUrl);
        } else {
          setError('OCR data not found. Please try re-uploading.');
        }
        setLoading(false);
      } catch (err) {
        setError('Connection lost. Please try refreshing.');
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

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

  const handleChange = (f, v) => setOcr(prev => ({ ...prev, [f]: v }));

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
          <div className="page-header"><h1>Confirm & Verify</h1><p>Check the extracted details against your receipt. Correct any errors before finishing.</p></div>

          {loading ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <div style={{width:48,height:48,border:'4px solid #e2e8f0',borderTopColor:'var(--primary)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
              <p style={{color:'var(--text-sub)'}}>Processing your receipt...</p>
            </div>
          ) : error ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <p style={{color:'var(--danger)',marginBottom:16}}>{error}</p>
              <Link to="/upload-receipt" className="btn btn-primary">Try Again</Link>
            </div>
          ) : (
            <form onSubmit={handleConfirm}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr',gap:24,alignItems:'start'}}>
                <div className="card" style={{padding:0, overflow:'hidden', position:'sticky', top:24}}>
                  <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', background:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h3 className="card-title" style={{margin:0, fontSize:'.9rem'}}>Receipt Preview</h3>
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">Full View</a>
                  </div>
                  <div style={{background:'#f1f5f9', padding:10, minHeight:400, display:'flex', justifyContent:'center'}}>
                    <img src={receiptUrl} alt="Receipt" style={{maxWidth:'100%', display:'block', height:'fit-content', borderRadius:4}} />
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title" style={{marginBottom:20}}>Verify Details</h3>
                  <div style={{display:'flex', flexDirection:'column', gap:16}}>
                    <div className="form-group">
                      <label>Student Name</label>
                      <input type="text" value={ocr.name} onChange={e=>handleChange('name', e.target.value)} placeholder="Extracted name" style={{width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8}}/>
                    </div>
                    <div className="form-group">
                      <label>Department</label>
                      <input type="text" value={ocr.department} onChange={e=>handleChange('department', e.target.value)} placeholder="Extracted department" style={{width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8}}/>
                    </div>
                    <div className="form-group">
                      <label>Fee Type (Particulars)</label>
                      <input type="text" value={ocr.particulars} onChange={e=>handleChange('particulars', e.target.value)} placeholder="e.g. Tuition Fee" style={{width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8}}/>
                    </div>
                    <div className="form-group">
                      <label>Amount Paid</label>
                      <input type="text" value={ocr.amount} onChange={e=>handleChange('amount', e.target.value)} placeholder="e.g. ₹45,000" style={{width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8, fontWeight:600, color:'var(--primary)'}}/>
                    </div>
                    <div className="form-group">
                      <label>Bank Name</label>
                      <input type="text" value={ocr.bank} onChange={e=>handleChange('bank', e.target.value)} placeholder="Extracted bank" style={{width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8}}/>
                    </div>

                    <div style={{marginTop:10}}>
                      <button type="button" onClick={()=>setShowRaw(!showRaw)} style={{background:'none', border:'none', color:'var(--primary)', fontSize:'.85rem', cursor:'pointer', padding:0}}>
                        {showRaw ? 'hide' : 'show'} raw extracted text
                      </button>
                      {showRaw && (
                        <pre style={{marginTop:10, padding:12, background:'#f8fafc', borderRadius:8, border:'1px solid var(--border)', fontSize:'.75rem', whiteSpace:'pre-wrap', maxHeight:150, overflowY:'auto', color:'#64748b'}}>
                          {rawText}
                        </pre>
                      )}
                    </div>
                  </div>

                  <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:32}}>
                    <Link to="/upload-receipt" className="btn btn-outline" style={{padding:'10px 24px'}}>Re-upload</Link>
                    <button type="submit" className="btn btn-primary" disabled={confirming} style={{padding:'10px 24px'}}>
                      {confirming ? 'Submitting...' : '✓ Finish Verification'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}


        </main>
      </div>
    </div>
  )
}
