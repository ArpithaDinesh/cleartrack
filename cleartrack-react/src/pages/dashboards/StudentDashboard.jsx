import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI, ocrAPI } from '../../services/api'
import ProfileModal from '../../components/ProfileModal'
import './StudentDashboard.css'

export default function StudentDashboard() {
  const { user } = useAuth()
  const [busOpted, setBusOpted] = useState(user?.isBusUser || false)
  const [hostelOpted, setHostelOpted] = useState(user?.isHostelUser || false)
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || 'S'
  const [tuitionFile, setTuitionFile] = useState(null)
  const [busFile, setBusFile] = useState(null)
  const [hostelFile, setHostelFile] = useState(null)
  
  // OCR State maps for fee sections ('tuition', 'bus', 'hostel')
  // state: { status: 'idle' | 'processing' | 'success' | 'error', ocrData: null, requestId: null, message: '' }
  const [ocrStates, setOcrStates] = useState({
    tuition: { status: 'idle', ocrData: null, requestId: null, message: '' },
    bus:     { status: 'idle', ocrData: null, requestId: null, message: '' },
    hostel:  { status: 'idle', ocrData: null, requestId: null, message: '' }
  })
  
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)

  const handleOCRProcess = async (feeType, file) => {
    if (!file) return;
    setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'processing', message: 'Uploading receipt...' } }))
    
    try {
      // 1. Submit Request with File
      const formData = new FormData();
      formData.append('feeType', feeType);
      formData.append('semester', 'Even 2026'); // Can be made dynamic later
      formData.append('academicYear', '2025-2026');
      formData.append('receipt', file);

      const submitRes = await clearanceAPI.submitRequest(formData);
      const requestId = submitRes.request._id;
      const autoOcrData = submitRes.ocrData;

      // 2. Process OCR (Fallback if auto-OCR didn't run or wasn't included)
      if (autoOcrData) {
        setOcrStates(prev => ({ ...prev, [feeType]: { status: 'success', ocrData: autoOcrData, requestId, message: '' } }))
      } else {
        setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], message: 'Extracting details via OCR...' } }))
        const ocrRes = await ocrAPI.processOCR(requestId);
        setOcrStates(prev => ({ ...prev, [feeType]: { status: 'success', ocrData: ocrRes.ocrData, requestId, message: '' } }))
      }
    } catch (err) {
      setOcrStates(prev => ({ ...prev, [feeType]: { status: 'error', ocrData: null, requestId: null, message: err.message || 'OCR Processing failed.' } }))
    }
  }

  const handleConfirmDetails = async (feeType) => {
    const state = ocrStates[feeType];
    if (!state.requestId) return;
    
    try {
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'processing', message: 'Confirming details...' } }))
      await ocrAPI.confirmOCR(state.requestId, state.ocrData); // passing extracted data
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'success', message: 'Details confirmed! Click "Submit All" at the bottom when ready.' } }))
      alert(`✅ ${feeType.toUpperCase()} Fee details confirmed successfully. Please scroll down and click "Submit All Requests for Approval" to send it to your teacher.`);
    } catch (err) {
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'error', message: err.message || 'Failed to confirm.' } }))
    }
  }

  const handleSubmitAll = async () => {
    try {
      const confirmedCount = Object.values(ocrStates).filter(s => s.status === 'success').length;
      if (confirmedCount === 0) {
        alert("⚠️ Please upload and confirm at least one fee receipt first.");
        return;
      }

      setSubmitLoading(true);
      await clearanceAPI.submitAllRequests();
      alert("🚀 Success! All your fee clearance requests have been sent to your Teacher Dashboard for approval.");
      window.location.reload();
    } catch (err) {
      alert("❌ Submission failed: " + (err.message || "Unknown error"));
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="dashboard-body">
      <Sidebar role="student" />

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">Student Dashboard</div>
          <div className="topbar-right">
            <div className="topbar-badge">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="badge-dot"></span>
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

          {/* ── 1. PROFILE ── */}
          <div id="dashboard-section" className="section-anchor">
            <div className="page-header">
              <h1>Welcome back, {user?.fullName?.split(' ')[0] || 'Student'}!</h1>
            </div>

            <div className="profile-card" style={{ flexDirection: 'column', gap: 0 }}>
              <div className="profile-card-top">
                <div className="profile-avatar">{initials}</div>
                <div className="profile-name-block" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0 }}>{user?.fullName || '—'}</h2>
                  </div>
                  <p className="profile-id">University No: {user?.universityNumber || '—'}</p>
                  <div className="profile-tags">
                    <span className="profile-tag">{user?.department || '—'} – {user?.classYear || '—'}</span>
                    {user?.section && <span className="profile-tag">Section {user.section}</span>}
                    <span className="profile-tag">Roll: {user?.rollNumber || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="profile-details-row">
                {[
                  { label: 'Full Name', value: user?.fullName || '—' },
                  { label: 'University Number', value: user?.universityNumber || '—' },
                  { label: 'Department', value: user?.department || '—' },
                  { label: 'Class / Year', value: `${user?.classYear || '—'}${user?.section ? ', Sec ' + user.section : ''}` },
                  { label: 'Roll Number', value: user?.rollNumber || '—' },
                  { label: 'Admission No.', value: user?.admissionNumber || '—' },
                ].map((item) => (
                  <div className="profile-detail-item" key={item.label}>
                    <span className="pd-label">{item.label}</span>
                    <span className="pd-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 2. CLEARANCE REQUEST ── */}
          <div id="clearance-req" className="section-anchor" style={{ marginBottom: '36px' }}>
            <div className="section-heading">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Clearance Request
            </div>

            <form id="clearance-form" onSubmit={(e) => e.preventDefault()}>

              {/* ─ TUITION FEE ─ */}
              <div className="fee-cat">
                <div className="fee-cat-hdr">
                  <div className="fee-cat-title">
                    <div className="cat-icon blue">
                      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </div>
                    Tuition Fee
                  </div>
                  <span className="badge badge-warning">Pending</span>
                </div>
                <div className="fee-cat-body">
                  <label className="field-label">Payment Mode</label>
                  <div className="radio-grp">
                    <label className="radio-opt"><input type="radio" name="t-mode" value="fully" defaultChecked /> Fully Paid</label>
                    <label className="radio-opt"><input type="radio" name="t-mode" value="partially" /> Partially Paid</label>
                  </div>
                  <div className="inner-grid">
                    <div>
                      <label className="field-label">Upload Receipt</label>
                      <label htmlFor="t-file" className="upload-zone">
                        <div className="upload-icon-wrap">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <h4>{tuitionFile ? tuitionFile.name : 'Click to upload receipt'}</h4>
                        <p>JPG, PNG, PDF — max 10 MB</p>
                        <input type="file" id="t-file" accept="image/*,.pdf" onChange={e => setTuitionFile(e.target.files[0])} />
                      </label>
                      <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} 
                        disabled={!tuitionFile || ocrStates.tuition.status === 'processing' || ocrStates.tuition.status === 'success'}
                        onClick={() => handleOCRProcess('tuition', tuitionFile)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {ocrStates.tuition.status === 'processing' ? 'Processing...' : 'Upload & Process via OCR'}
                      </button>
                    </div>
                    <div>
                      <div className="field-label">OCR Extracted Details</div>
                      <div className="ocr-panel">
                        <div className="ocr-ptitle">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                          </svg> Extracted from Receipt
                        </div>
                        {ocrStates.tuition.status === 'processing' && (
                          <div className="ocr-fields" style={{ justifyContent: 'center', padding: '20px' }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 500 }}>⏳ {ocrStates.tuition.message}</span>
                          </div>
                        )}
                        
                        {ocrStates.tuition.status === 'error' && (
                          <div className="ocr-fields" style={{ justifyContent: 'center', padding: '20px' }}>
                            <span style={{ color: '#dc2626', fontWeight: 500 }}>❌ {ocrStates.tuition.message}</span>
                          </div>
                        )}

                        {ocrStates.tuition.status === 'success' && ocrStates.tuition.ocrData && (
                          <div className="ocr-fields">
                            <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Student Name</label><span>{ocrStates.tuition.ocrData.studentName || '—'}</span></div>
                            <div className="ocr-field"><label>Transaction ID</label><span>{ocrStates.tuition.ocrData.transactionId || '—'}</span></div>
                            <div className="ocr-field"><label>Amount Paid</label><span>{ocrStates.tuition.ocrData.amount || '—'}</span></div>
                            <div className="ocr-field"><label>Payment Date</label><span>{ocrStates.tuition.ocrData.paymentDate || '—'}</span></div>
                            <div className="ocr-field"><label>Bank / Mode</label><span>{ocrStates.tuition.ocrData.bankName || ocrStates.tuition.ocrData.paymentMode || '—'}</span></div>
                          </div>
                        )}

                        {ocrStates.tuition.status === 'idle' && (
                          <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-sub)', fontSize: '.82rem' }}>
                            📂 Upload a receipt to extract details via OCR
                          </div>
                        )}

                        <div className="ocr-note">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg> Read-only — extracted via OCR, no manual editing.
                        </div>
                        <div className="ocr-actions">
                          <button type="button" className="btn btn-success" style={{ flex: 1, fontSize: '.8rem', padding: '8px 10px' }} 
                            disabled={ocrStates.tuition.status !== 'success'}
                            onClick={() => handleConfirmDetails('tuition')}>
                            ✓ Confirm Details
                          </button>
                          <button type="button" className="btn btn-outline" style={{ fontSize: '.8rem', padding: '8px 10px' }} 
                            disabled={ocrStates.tuition.status === 'processing'}
                            onClick={() => { setTuitionFile(null); setOcrStates(prev => ({...prev, tuition: {status: 'idle', ocrData: null, requestId: null, message: ''}})) }}>
                            ↺ Re-upload
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─ BUS FEE ─ */}
              <div className="fee-cat">
                <div className="fee-cat-hdr">
                  <div className="fee-cat-title">
                    <div className="cat-icon green">
                      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13" rx="2" />
                        <path d="M16 8h4l3 3v5h-7V8z" />
                        <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    </div>
                    Bus Fee
                  </div>
                  <span className="badge badge-success">Fully Paid</span>
                </div>
                <div className="fee-cat-body">
                  <label className="field-label">Bus Service</label>
                  <div className="radio-grp">
                    <label className="radio-opt">
                      <input type="radio" name="bus-opt" value="opted" onChange={() => setBusOpted(true)} /> Opted
                    </label>
                    <label className="radio-opt">
                      <input type="radio" name="bus-opt" value="not-opted" defaultChecked onChange={() => setBusOpted(false)} /> Not Opted
                    </label>
                  </div>
                  {busOpted && (
                    <div>
                      <label className="field-label">Payment Mode</label>
                      <div className="radio-grp">
                        <label className="radio-opt"><input type="radio" name="bus-mode" value="fully" defaultChecked /> Fully Paid</label>
                        <label className="radio-opt"><input type="radio" name="bus-mode" value="partially" /> Partially Paid</label>
                      </div>
                      <div className="inner-grid">
                        <div>
                          <label className="field-label">Upload Receipt</label>
                          <label htmlFor="bus-file" className="upload-zone">
                            <div className="upload-icon-wrap" style={{ background: '#d1fae5', color: 'var(--success)' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                            </div>
                            <h4>{busFile ? busFile.name : 'Click to upload receipt'}</h4>
                            <p>JPG, PNG, PDF — max 10 MB</p>
                            <input type="file" id="bus-file" accept="image/*,.pdf" onChange={e => setBusFile(e.target.files[0])} />
                          </label>
                          <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} 
                            disabled={!busFile || ocrStates.bus.status === 'processing' || ocrStates.bus.status === 'success'}
                            onClick={() => handleOCRProcess('bus', busFile)}>
                            {ocrStates.bus.status === 'processing' ? 'Processing...' : 'Upload & Process via OCR'}
                          </button>
                        </div>
                        <div>
                          <div className="field-label">OCR Extracted Details</div>
                          <div className="ocr-panel">
                            <div className="ocr-ptitle">Extracted from Receipt</div>
                            
                            {ocrStates.bus.status === 'processing' && (
                              <div className="ocr-fields" style={{ justifyContent: 'center', padding: '20px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>⏳ {ocrStates.bus.message}</span>
                              </div>
                            )}
                            
                            {ocrStates.bus.status === 'error' && (
                              <div className="ocr-fields" style={{ justifyContent: 'center', padding: '20px' }}>
                                <span style={{ color: '#dc2626', fontWeight: 500 }}>❌ {ocrStates.bus.message}</span>
                              </div>
                            )}

                            {ocrStates.bus.status === 'success' && ocrStates.bus.ocrData && (
                              <div className="ocr-fields">
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Student Name</label><span>{ocrStates.bus.ocrData.studentName || '—'}</span></div>
                                <div className="ocr-field"><label>Transaction ID</label><span>{ocrStates.bus.ocrData.transactionId || '—'}</span></div>
                                <div className="ocr-field"><label>Amount Paid</label><span>{ocrStates.bus.ocrData.amount || '—'}</span></div>
                                <div className="ocr-field"><label>Payment Date</label><span>{ocrStates.bus.ocrData.paymentDate || '—'}</span></div>
                                <div className="ocr-field"><label>Bank / Mode</label><span>{ocrStates.bus.ocrData.bankName || ocrStates.bus.ocrData.paymentMode || '—'}</span></div>
                              </div>
                            )}

                            {ocrStates.bus.status === 'idle' && (
                              <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-sub)', fontSize: '.82rem' }}>
                                📂 Upload a receipt to extract details via OCR
                              </div>
                            )}

                            <div className="ocr-actions">
                              <button type="button" className="btn btn-success" style={{ flex: 1, fontSize: '.8rem', padding: '8px 10px' }} 
                                disabled={ocrStates.bus.status !== 'success'}
                                onClick={() => handleConfirmDetails('bus')}>
                                ✓ Confirm Details
                              </button>
                              <button type="button" className="btn btn-outline" style={{ fontSize: '.8rem', padding: '8px 10px' }} 
                                disabled={ocrStates.bus.status === 'processing'}
                                onClick={() => { setBusFile(null); setOcrStates(prev => ({...prev, bus: {status: 'idle', ocrData: null, requestId: null, message: ''}})) }}>
                                ↺ Re-upload
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ─ HOSTEL FEE ─ */}
              <div className="fee-cat">
                <div className="fee-cat-hdr">
                  <div className="fee-cat-title">
                    <div className="cat-icon violet">
                      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    Hostel Fee
                  </div>
                  <span className="badge badge-danger">Not Paid</span>
                </div>
                <div className="fee-cat-body">
                  <label className="field-label">Hostel Accommodation</label>
                  <div className="radio-grp">
                    <label className="radio-opt">
                      <input type="radio" name="hostel-opt" value="opted" onChange={() => setHostelOpted(true)} /> Opted
                    </label>
                    <label className="radio-opt">
                      <input type="radio" name="hostel-opt" value="not-opted" defaultChecked onChange={() => setHostelOpted(false)} /> Not Opted
                    </label>
                  </div>
                  {hostelOpted && (
                    <div>
                      <label className="field-label">Payment Mode</label>
                      <div className="radio-grp">
                        <label className="radio-opt"><input type="radio" name="hostel-mode" value="fully" /> Fully Paid</label>
                        <label className="radio-opt"><input type="radio" name="hostel-mode" value="partially" defaultChecked /> Partially Paid</label>
                      </div>
                      <div className="inner-grid">
                        <div>
                          <label className="field-label">Upload Receipt</label>
                          <label htmlFor="hostel-file" className="upload-zone">
                            <div className="upload-icon-wrap" style={{ background: '#ede9fe', color: 'var(--accent)' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                            </div>
                            <h4>{hostelFile ? hostelFile.name : 'Click to upload receipt'}</h4>
                            <p>JPG, PNG, PDF — max 10 MB</p>
                            <input type="file" id="hostel-file" accept="image/*,.pdf" onChange={e => setHostelFile(e.target.files[0])} />
                          </label>
                          <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} 
                            disabled={!hostelFile || ocrStates.hostel.status === 'processing' || ocrStates.hostel.status === 'success'}
                            onClick={() => handleOCRProcess('hostel', hostelFile)}>
                            {ocrStates.hostel.status === 'processing' ? 'Processing...' : 'Upload & Process via OCR'}
                          </button>
                        </div>
                        <div>
                          <div className="field-label">OCR Extracted Details</div>
                          <div className="ocr-panel">
                            <div className="ocr-ptitle">Extracted from Receipt</div>
                            
                            {ocrStates.hostel.status === 'processing' && (
                              <div className="ocr-fields" style={{ justifyContent: 'center', padding: '20px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>⏳ {ocrStates.hostel.message}</span>
                              </div>
                            )}
                            
                            {ocrStates.hostel.status === 'error' && (
                              <div className="ocr-fields" style={{ justifyContent: 'center', padding: '20px' }}>
                                <span style={{ color: '#dc2626', fontWeight: 500 }}>❌ {ocrStates.hostel.message}</span>
                              </div>
                            )}

                            {ocrStates.hostel.status === 'success' && ocrStates.hostel.ocrData && (
                              <div className="ocr-fields">
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Student Name</label><span>{ocrStates.hostel.ocrData.studentName || '—'}</span></div>
                                <div className="ocr-field"><label>Transaction ID</label><span>{ocrStates.hostel.ocrData.transactionId || '—'}</span></div>
                                <div className="ocr-field"><label>Amount Paid</label><span>{ocrStates.hostel.ocrData.amount || '—'}</span></div>
                                <div className="ocr-field"><label>Payment Date</label><span>{ocrStates.hostel.ocrData.paymentDate || '—'}</span></div>
                                <div className="ocr-field"><label>Bank / Mode</label><span>{ocrStates.hostel.ocrData.bankName || ocrStates.hostel.ocrData.paymentMode || '—'}</span></div>
                              </div>
                            )}

                            {ocrStates.hostel.status === 'idle' && (
                              <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-sub)', fontSize: '.82rem' }}>
                                📂 Upload a receipt to extract details via OCR
                              </div>
                            )}

                            <div className="ocr-actions">
                              <button type="button" className="btn btn-success" style={{ flex: 1, fontSize: '.8rem', padding: '8px 10px' }} 
                                disabled={ocrStates.hostel.status !== 'success'}
                                onClick={() => handleConfirmDetails('hostel')}>
                                ✓ Confirm Details
                              </button>
                              <button type="button" className="btn btn-outline" style={{ fontSize: '.8rem', padding: '8px 10px' }} 
                                disabled={ocrStates.hostel.status === 'processing'}
                                onClick={() => { setHostelFile(null); setOcrStates(prev => ({...prev, hostel: {status: 'idle', ocrData: null, requestId: null, message: ''}})) }}>
                                ↺ Re-upload
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* ── 3. CLEARANCE STATUS ── */}
          <div id="clearance-status" className="section-anchor">
            <div className="section-heading">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Clearance Status
            </div>

            <div className="status-bar pending" style={{ marginBottom: '20px' }}>
              <div className="sb-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="sb-info">
                <h3>No Clearance Request Submitted</h3>
                <p>Upload your fee receipts above and submit a clearance request to see the status here.</p>
              </div>
              <span className="badge badge-neutral" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>Not Submitted</span>
            </div>

            {/* Final Clearance Certificate */}
            <div className="clearance-form-card">
              <div className="cf-header">
                <h3>📄 Final Clearance Certificate</h3>
              </div>
              <div className="cf-body">
                <p style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-sub)', marginBottom: '12px' }}>Student Details</p>
                <div className="cf-student-grid">
                  <div className="cf-field"><label>Full Name</label><span>{user?.fullName || '—'}</span></div>
                  <div className="cf-field"><label>Department</label><span>{user?.department || '—'}</span></div>
                  <div className="cf-field"><label>Class / Year</label><span>{user?.classYear || '—'}</span></div>
                  <div className="cf-field"><label>Admission Number</label><span>{user?.admissionNumber || '—'}</span></div>
                  <div className="cf-field"><label>University Number</label><span>{user?.universityNumber || '—'}</span></div>
                </div>
                <p style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-sub)', marginBottom: '12px' }}>Fee Clearance Status</p>
                <table className="cf-fee-table">
                  <thead>
                    <tr>
                      <th>Fee Category</th><th>Amount Due</th><th>Amount Paid</th><th>Payment Mode</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Tuition Fee</td><td>—</td><td>—</td><td>—</td>
                      <td><span className="badge badge-neutral">Not Submitted</span></td>
                    </tr>
                    {busOpted && (
                      <tr>
                        <td>Bus Fee</td><td>—</td><td>—</td><td>—</td>
                        <td><span className="badge badge-neutral">Not Submitted</span></td>
                      </tr>
                    )}
                    {hostelOpted && (
                      <tr>
                        <td>Hostel Fee</td><td>—</td><td>—</td><td>—</td>
                        <td><span className="badge badge-neutral">Not Submitted</span></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="cf-footer">
                  <span className="cf-stamp pending">⏳ Overall Status: Pending — Submit clearance request to proceed</span>
                  <button type="button" className="btn btn-outline btn-sm" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Print / Download
                  </button>
                </div>
              </div>
            </div>

            <div className="final-submit-box" style={{ 
              marginTop: '40px', padding: '30px', background: 'white', borderRadius: '12px', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #eef2f6' 
            }}>
              <h3 style={{ marginBottom: '10px', color: '#1e293b' }}>Confirm and Submit</h3>
              <button 
                type="button"
                className="btn btn-primary" 
                style={{ padding: '12px 40px', fontSize: '1.05rem', fontWeight: 'bold' }}
                disabled={submitLoading}
                onClick={handleSubmitAll}
              >
                {submitLoading ? 'Sending...' : 'Submit All Requests for Approval'}
              </button>
            </div>
          </div>
        </main>
      </div>
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  )
}
