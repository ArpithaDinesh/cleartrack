import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ocrAPI, clearanceAPI } from '../../services/api'

export default function OCRConfirm() {
  const { user, logout } = useAuth()
  const { requestId } = useParams()
  const navigate = useNavigate()
  const [ocr, setOcr] = useState({
    studentName:'', department:'', feeCategory:'',
    transactionId:'', amount:'', paymentDate:'',
    receiptNumber:'', bankName:'', paymentMode:''
  })
  const [rawText, setRawText] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [viewMode, setViewMode] = useState('image') // 'image' or 'text'
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'S'

  const applyOcrData = (d, rt, rUrl) => {
    setOcr({
      studentName:   d.studentName   || '',
      department:    d.department    || '',
      feeCategory:   d.feeCategory   || '',
      transactionId: d.transactionId || '',
      amount:        d.amount        || '',
      paymentDate:   d.paymentDate   || '',
      receiptNumber: d.receiptNumber || '',
      bankName:      d.bankName      || '',
      paymentMode:   d.paymentMode   || '',
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
        
        // Build the full image URL
        const backendUrl = import.meta.env.VITE_API_URL || 'https://cleartrack-backend.vercel.app';
        const imgUrl = req.receiptFile?.filename ? `${backendUrl}/uploads/${req.receiptFile.filename}` : '';

        if (d.ocrStatus === 'completed') {
          applyOcrData(d, d.rawText, imgUrl);
        } else {
          setError('OCR data not found for this request. Please try re-uploading.');
        }
        setLoading(false);
      } catch (err) {
        setError('Connection lost. Please check your internet or try refreshing.');
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


  return (
    <div className="dashboard-body">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div><div className="logo-text"><span>CLEARTRACK</span><small>Student Panel <span style={{opacity:0.5, fontSize:'10px'}}>v1.1.0</span></small></div></div>
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
          <div className="page-header"><h1>Confirm & Verify</h1><p>Check the extracted details against your uploaded receipt. Correct any mistakes before finishing.</p></div>

          {loading ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <div style={{width:48,height:48,border:'4px solid #e2e8f0',borderTopColor:'var(--primary)',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
              <p style={{color:'var(--text-sub)'}}>Loading your data…</p>
            </div>
          ) : error ? (
            <div className="card" style={{textAlign:'center',padding:48}}>
              <p style={{color:'var(--danger)',marginBottom:16}}>{error}</p>
              <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                <Link to="/upload-receipt" className="btn btn-primary">Re-upload File</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirm}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,alignItems:'start'}}>
                <div className="card" style={{height:'580px', display:'flex', flexDirection:'column'}}>
                  <h3 className="card-title" style={{marginBottom:20, display:'flex', alignItems:'center', gap:10}}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Full Extracted Data
                  </h3>
                  
                  <div style={{flex:1, display:'flex', flexDirection:'column', gap:12}}>
                    <p style={{fontSize:'.8rem', color:'var(--text-sub)'}}>This is the complete text extracted from your receipt. Please verify it matches the image.</p>
                    <textarea 
                      value={rawText} 
                      onChange={e=>setRawText(e.target.value)}
                      style={{
                        flex:1,
                        padding:'16px',
                        fontSize:'.85rem',
                        lineHeight:'1.6',
                        border:'1.5px solid var(--border)',
                        borderRadius:8,
                        fontFamily:'monospace',
                        resize:'none',
                        background:'#fff'
                      }}
                      placeholder="No text extracted from bill..."
                    />
                  </div>

                  <div style={{marginTop:20, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'12px 16px', fontSize:'.8rem', color:'#0369a1', display:'flex', gap:10, alignItems:'center'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span>Click confirm if the extracted text correctly represents your bill.</span>
                  </div>
                </div>

                <div className="card" style={{padding:0, overflow:'hidden', display:'flex', flexDirection:'column', height:'580px'}}>
                  <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)'}}>
                    <h3 className="card-title" style={{margin:0, fontSize:'.9rem'}}>Original Receipt Image</h3>
                  </div>
                  
                  <div style={{flex:1, overflow:'auto', background:'#f1f5f9', display:'flex', justifyContent:'center'}}>
                    {receiptUrl ? (
                      <img src={receiptUrl} alt="Uploaded Receipt" style={{maxWidth:'100%', display:'block', height:'fit-content'}} />
                    ) : (
                      <div style={{padding:40, textAlign:'center', color:'var(--text-sub)'}}>Receipt image could not be loaded.</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:24}}>
                <Link to="/upload-receipt" className="btn btn-outline" style={{padding:'12px 28px'}}>← Re-upload</Link>
                <button type="submit" className="btn btn-primary" disabled={confirming} style={{padding:'12px 28px'}}>
                  {confirming ? 'Submitting…' : '✓ Confirm Extracted Data'}
                </button>
              </div>
            </form>
          )}


        </main>
      </div>
    </div>
  )
}
