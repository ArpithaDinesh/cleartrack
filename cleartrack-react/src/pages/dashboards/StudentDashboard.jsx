import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../context/AuthContext'
import { clearanceAPI, ocrAPI, busAPI, tuitionFeeAPI, API_ROOT } from '../../services/api'
import ProfileModal from '../../components/ProfileModal'
import { createWorker } from 'tesseract.js'
import { parseOCRFields } from '../../utils/ocrParser'
import { preprocessImage, waitForCV } from '../../utils/cvPreprocessor'
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
  });
  const [rawOcrText, setRawOcrText] = useState('');
  
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)

  // Bus Fee States
  const [busRoutes, setBusRoutes] = useState([])
  const [selectedBusGroup, setSelectedBusGroup] = useState('')
  const [selectedSubLocationId, setSelectedSubLocationId] = useState('')
  const [isHalfFee, setIsHalfFee] = useState(false)

  // Tuition Fee States
  const [allTuitionFees, setAllTuitionFees] = useState([])
  const [selectedTuitionCategory, setSelectedTuitionCategory] = useState('')
  const [isHalfTuition, setIsHalfTuition] = useState(false)
  const [feeError, setFeeError] = useState(null)

  const [clearanceRequests, setClearanceRequests] = useState([])

  const fetchMyRequests = () => {
    clearanceAPI.getMyRequests()
      .then(res => setClearanceRequests(res.requests || []))
      .catch(console.error)
  }

  useEffect(() => {
    busAPI.getRoutes().then(res => setBusRoutes(res.routes || [])).catch(console.error)
    tuitionFeeAPI.getFees()
      .then(res => setAllTuitionFees(res.fees || []))
      .catch(err => {
        console.error(err);
        setFeeError('Failed to load fee structure.');
      })
    
    fetchMyRequests()
  }, [])

  const studentYearFees = allTuitionFees.find(f => f.year === user?.classYear)
  const baseTuitionAmount = studentYearFees ? (studentYearFees[selectedTuitionCategory] || 0) : 0
  const calculatedTuitionFee = isHalfTuition ? baseTuitionAmount / 2 : baseTuitionAmount

  const selectedSubLocation = busRoutes.find(r => r._id === selectedSubLocationId)
  const calculatedBusFee = selectedSubLocation ? (isHalfFee ? selectedSubLocation.fee / 2 : selectedSubLocation.fee) : 0

  const handleOCRProcess = async (feeType, file) => {
    if (!file) return;
    setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'processing', message: 'Initializing OCR...' } }))
    let worker = null;
    
    try {
      // 1. Run Preprocessing (OpenCV)
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'processing', message: 'Enhancing image quality...' } }))
      await waitForCV();
      
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(r => img.onload = r);
      
      const processedSrc = await preprocessImage(img);
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], message: 'Initializing OCR engine...' } }))

      // 2. Run OCR in the browser
      worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], message: `Analyzing receipt... ${Math.round(m.progress * 100)}%` } }))
          }
        }
      });

      await worker.setParameters({
        tessedit_pageseg_mode: '3',
      });
      
      const { data: { text } } = await worker.recognize(processedSrc);
      const hintAmount = feeType === 'tuition' ? calculatedTuitionFee : feeType === 'bus' ? calculatedBusFee : 0;
      const ocrData = parseOCRFields(text, user?.fullName, hintAmount);
      setRawOcrText(text);
      await worker.terminate();
      worker = null;

      // 3. Submit Request with File and OCR data
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], message: 'Uploading to server...' } }))
      
      // Convert processed DataURL to Blob for upload
      const response = await fetch(processedSrc);
      const blob = await response.blob();
      const processedFile = new File([blob], `receipt_${feeType}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('ocrData', JSON.stringify(ocrData));
      formData.append('feeType', feeType);
      formData.append('semester', 'Even 2026'); 
      formData.append('academicYear', '2025-2026');
      formData.append('receipt', processedFile);

      const submitRes = await clearanceAPI.submitRequest(formData);
      const requestId = submitRes.request._id;

      setOcrStates(prev => ({ ...prev, [feeType]: { status: 'success', ocrData, requestId, message: '' } }))
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrStates(prev => ({ ...prev, [feeType]: { status: 'error', ocrData: null, requestId: null, message: err.message || 'OCR Processing failed.' } }))
    } finally {
      if (worker) await worker.terminate();
    }
  }

  const handleConfirmDetails = async (feeType) => {
    const state = ocrStates[feeType];
    if (!state.requestId) return;
    
    try {
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'processing', message: 'Confirming details...' } }))
      
      // Include the payment structure chosen by student
      const confirmedData = {
        ...state.ocrData,
        paymentType: feeType === 'tuition' ? (isHalfTuition ? 'half' : 'full') : 
                     feeType === 'bus' ? (isHalfFee ? 'half' : 'full') : 'full'
      };

      await ocrAPI.confirmOCR(state.requestId, confirmedData);
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'confirmed', ocrData: confirmedData, message: 'Details confirmed! Now click the "Submit for Approval" button below to send it to your teacher.' } }))
      alert(`✅ ${feeType.toUpperCase()} Fee details confirmed. \n\nIMPORTANT: Your teacher won't see this yet! \n\nPlease click the "🚀 Submit for Approval" button to finalize.`);
    } catch (err) {
      setOcrStates(prev => ({ ...prev, [feeType]: { ...prev[feeType], status: 'error', message: err.message || 'Failed to confirm.' } }))
    }
  }

  const handleSubmitFee = async (feeType) => {
    const state = ocrStates[feeType];
    if (!state.requestId) return;

    try {
      setSubmitLoading(true);
      await clearanceAPI.submitDraft(state.requestId);
      
      setOcrStates(prev => ({ 
        ...prev, 
        [feeType]: { ...prev[feeType], status: 'submitted', message: 'Success! Your receipt has been sent to your teacher.' } 
      }));

      fetchMyRequests();
      
      alert(`🚀 SUCCESS! \n\nYour ${feeType.toUpperCase()} Fee receipt has been sent to your teacher for approval. \n\nYou can track the status in the "Clearance Status" section below.`);
    } catch (err) {
      alert(`❌ Submission Failed: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  }

  const getFeeBadge = (feeType) => {
    const req = clearanceRequests.find(r => r.feeType === feeType);
    if (!req) return <span className="badge badge-neutral">Not Submitted</span>;

    // Status logic: pending until approved by teacher
    const teacherApproval = req.departmentApprovals?.find(a => a.department === 'class_teacher');
    const isApproved = teacherApproval?.status === 'approved';

    if (!isApproved) {
      return <span className="badge badge-warning">Pending</span>;
    }

    // Approved -> Check if it was half or full
    const pType = req.ocrData?.paymentType || 'full';
    if (pType === 'half') {
      return <span className="badge badge-warning">Half Paid</span>;
    } else {
      return <span className="badge badge-success">Fully Paid</span>;
    }
  };

  const handleSubmitFee = async (feeType) => {
    try {
      setSubmitLoading(true);
      await clearanceAPI.submitAllRequests();
      alert(`✅ ${feeType.charAt(0).toUpperCase() + feeType.slice(1)} Fee clearance request has been sent to your Teacher Dashboard for approval.`);
      window.location.reload();
    } catch (err) {
      alert('Submission failed: ' + (err.message || 'Unknown error'));
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
                  {getFeeBadge('tuition')}
                </div>
                <div className="card">
                  
                  <div style={{background: '#f0f9ff', padding: '15px', borderRadius: '10px', border: '1px solid #bae6fd', marginBottom: 20}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                      <span style={{fontSize: '.85rem', color: '#0369a1', fontWeight: 600}}>Your Academic Year:</span>
                      <span style={{background: '#0ea5e9', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '.8rem', fontWeight: 600}}>{user?.classYear || 'Not Specified'}</span>
                    </div>

                    {feeError && (
                      <div style={{background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px', borderRadius: '6px', fontSize: '.75rem', marginBottom: 15}}>
                        ❌ {feeError}
                      </div>
                    )}

                    {!studentYearFees && allTuitionFees.length > 0 && (
                      <div style={{background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '8px', borderRadius: '6px', fontSize: '.75rem', marginBottom: 15}}>
                        ⚠️ Your year "{user?.classYear}" is not configured in the system. Please contact admin.
                      </div>
                    )}

                    <label className="field-label" style={{marginBottom: 8, display: 'block'}}>1. Select Fee Category</label>
                    <select 
                      className="form-control" 
                      style={{width: '100%', marginBottom: 15, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}
                      value={selectedTuitionCategory}
                      onChange={e => setSelectedTuitionCategory(e.target.value)}
                    >
                      <option value="">Choose category...</option>
                      <option value="meritReg">Merit Fee (Regulated)</option>
                      <option value="meritFull">Merit Fee (Full fee)</option>
                      <option value="tfw">Tuition Fee Waiver</option>
                      <option value="nri">NRI</option>
                    </select>

                    <label className="field-label" style={{marginBottom: 10, display: 'block'}}>2. Fee Structure</label>
                    <div className="radio-grp" style={{marginBottom: 15}}>
                      <label className="radio-opt">
                        <input type="radio" name="tuition-fee-type" checked={!isHalfTuition} onChange={() => setIsHalfTuition(false)} /> Full Fee
                      </label>
                      <label className="radio-opt">
                        <input type="radio" name="tuition-fee-type" checked={isHalfTuition} onChange={() => setIsHalfTuition(true)} /> Half Fee
                      </label>
                    </div>

                    {selectedTuitionCategory && (
                      <div style={{padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #0ea5e9', display: 'flex', flexDirection: 'column', gap: 5}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <span style={{fontWeight: 500, color: '#0369a1'}}>Calculated Tuition Fee:</span>
                          <span style={{fontWeight: 700, color: '#0284c7', fontSize: '1.1rem'}}>₹{calculatedTuitionFee.toLocaleString()}</span>
                        </div>
                        {calculatedTuitionFee === 0 && (
                          <div style={{fontSize: '.75rem', color: '#64748b', fontStyle: 'italic'}}>
                            * Contact admin if fee is not configured for your category.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{borderTop: '1px solid #e2e8f0', paddingTop: 20}}>
                    <label className="field-label">3. Payment Mode & Receipt</label>
                    <div className="radio-grp" style={{marginBottom: 15}}>
                      <label className="radio-opt"><input type="radio" name="tuition-mode" value="fully" defaultChecked /> Fully Paid</label>
                      <label className="radio-opt"><input type="radio" name="tuition-mode" value="partially" /> Partially Paid</label>
                    </div>
                    <div className="inner-grid">
                      <div>
                        <label className="field-label">Upload Receipt</label>
                        <label htmlFor="tuition-file" className="upload-zone">
                          <div className="upload-icon-wrap">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          </div>
                          <h4>{tuitionFile ? tuitionFile.name : 'Click to upload receipt'}</h4>
                          <p>JPG, PNG, PDF — max 10 MB</p>
                          <input type="file" id="tuition-file" accept="image/*,.pdf" onChange={e => setTuitionFile(e.target.files[0])} />
                        </label>
                        <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} 
                          disabled={!tuitionFile || ocrStates.tuition.status === 'processing' || ocrStates.tuition.status === 'success'}
                          onClick={() => handleOCRProcess('tuition', tuitionFile)}>
                          {ocrStates.tuition.status === 'processing' ? 'Processing...' : 'Upload & Process via OCR'}
                        </button>
                      </div>
                      <div>
                        <div className="field-label">OCR Extracted Details</div>
                        <div className="ocr-panel">
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5}}>
                            <div className="ocr-ptitle">Extracted from Receipt</div>
                            {tuitionFile && (
                              <a href={URL.createObjectURL(tuitionFile)} target="_blank" rel="noreferrer" style={{fontSize:'.75rem', color:'var(--primary)', textDecoration:'underline'}}>
                                Preview Receipt
                              </a>
                            )}
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
                                {ocrStates.tuition.ocrData.hintUsed > 0 && (
                                  <div style={{gridColumn:'1/-1', background:'#f0f9ff', padding:'4px 8px', borderRadius:4, fontSize:'.7rem', color:'#0369a1', marginBottom:5}}>
                                    💡 <strong>Hinting active:</strong> Searching for approx. ₹{ocrStates.tuition.ocrData.hintUsed.toLocaleString()}
                                  </div>
                                )}
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Student Name</label><span>{ocrStates.tuition.ocrData.name || '—'}</span></div>
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Department</label><span>{ocrStates.tuition.ocrData.department || '—'}</span></div>
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Particulars</label><span>{ocrStates.tuition.ocrData.particulars || '—'}</span></div>
                                <div className="ocr-field"><label>Amount</label><span>{ocrStates.tuition.ocrData.amount || '—'}</span></div>
                                <div className="ocr-field"><label>Bank Name</label><span>{ocrStates.tuition.ocrData.bank || '—'}</span></div>
                                <div className="ocr-field"><label>Date</label><span>{ocrStates.tuition.ocrData.date || '—'}</span></div>
                              </div>
                          )}

                          {ocrStates.tuition.status === 'idle' && (
                            <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-sub)', fontSize: '.82rem' }}>
                               Upload a receipt to extract details via OCR
                            </div>
                          )}

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
                          <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px', fontSize: '.85rem', fontWeight: 600 }}
                            disabled={ocrStates.tuition.status !== 'confirmed' || submitLoading}
                            onClick={() => handleSubmitFee('tuition')}>
                            {submitLoading ? 'Submitting...' : '🚀 Final Submit for Approval'}
                          </button>
                          {rawOcrText && (
                            <div style={{marginTop: 10, padding: 8, background: '#f8fafc', color: '#64748b', fontSize: '.65rem', borderRadius: 6, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'auto'}}>
                              <strong>🔍 RAW OCR OUTPUT:</strong><br/>
                              {rawOcrText}
                            </div>
                          )}
                          {ocrStates.tuition.status === 'confirmed' && (
                            <div style={{marginTop: 10, padding: 8, background: '#fffbeb', color: '#92400e', fontSize: '.75rem', borderRadius: 6, border: '1px solid #fde68a', textAlign: 'center'}}>
                              ⚠️ One step left! Click the button above to send to your teacher.
                            </div>
                          )}
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
                  {busOpted ? getFeeBadge('bus') : <span className="badge badge-neutral">Not Opted</span>}
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
                    <div style={{marginTop: 15, display: 'flex', flexDirection: 'column', gap: 20}}>
                      <div className="inner-grid" style={{gridTemplateColumns: '1fr', gap: 15}}>
                        <div style={{background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
                          <label className="field-label" style={{marginBottom: 10, display: 'block'}}>1. Select Main Location</label>
                          <div className="radio-grp" style={{marginBottom: 15}}>
                            {['Kannur', 'Mattannur', 'Thalassery'].map(loc => (
                              <label key={loc} className="radio-opt" style={{padding: '6px 12px', background: selectedBusGroup === loc ? '#eff6ff' : 'white', borderRadius: '6px', border: '1px solid', borderColor: selectedBusGroup === loc ? '#3b82f6' : '#cbd5e1'}}>
                                <input type="radio" name="bus-group" value={loc} checked={selectedBusGroup === loc} onChange={e => { setSelectedBusGroup(e.target.value); setSelectedSubLocationId(''); }} /> {loc}
                              </label>
                            ))}
                          </div>

                          <label className="field-label" style={{marginBottom: 5, display: 'block'}}>2. Select Sub Location</label>
                          <select 
                            className="form-control" 
                            style={{width: '100%', marginBottom: 15, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1'}}
                            value={selectedSubLocationId}
                            onChange={e => setSelectedSubLocationId(e.target.value)}
                            disabled={!selectedBusGroup}
                          >
                            <option value="">{selectedBusGroup ? 'Choose your stop...' : 'Select Main Location first'}</option>
                            {busRoutes.filter(r => r.group === selectedBusGroup).map(r => (
                              <option key={r._id} value={r._id}>{r.location} (₹{r.fee.toLocaleString()})</option>
                            ))}
                          </select>

                          <label className="field-label" style={{marginBottom: 10, display: 'block'}}>3. Fee Structure</label>
                          <div className="radio-grp">
                            <label className="radio-opt">
                              <input type="radio" name="bus-fee-type" checked={!isHalfFee} onChange={() => setIsHalfFee(false)} /> Full Fee
                            </label>
                            <label className="radio-opt">
                              <input type="radio" name="bus-fee-type" checked={isHalfFee} onChange={() => setIsHalfFee(true)} /> Half Fee
                            </label>
                          </div>

                          {selectedSubLocation && (
                            <div style={{marginTop: 15, padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <span style={{fontWeight: 500, color: '#065f46'}}>Your Calculated Bus Fee:</span>
                              <span style={{fontWeight: 700, color: '#047857', fontSize: '1.1rem'}}>₹{calculatedBusFee.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{borderTop: '1px solid #e2e8f0', paddingTop: 20}}>
                        <label className="field-label">4. Payment Mode & Receipt</label>
                        <div className="radio-grp" style={{marginBottom: 15}}>
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
                                  <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Student Name</label><span>{ocrStates.bus.ocrData.name || '—'}</span></div>
                                  <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Department</label><span>{ocrStates.bus.ocrData.department || '—'}</span></div>
                                  <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Particulars</label><span>{ocrStates.bus.ocrData.particulars || '—'}</span></div>
                                  <div className="ocr-field"><label>Amount</label><span>{ocrStates.bus.ocrData.amount || '—'}</span></div>
                                  <div className="ocr-field"><label>Bank Name</label><span>{ocrStates.bus.ocrData.bank || '—'}</span></div>
                                  <div className="ocr-field"><label>Date</label><span>{ocrStates.bus.ocrData.date || '—'}</span></div>
                                </div>
                              )}

                              {ocrStates.bus.status === 'idle' && (
                                <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-sub)', fontSize: '.82rem' }}>
                                   Upload a receipt to extract details via OCR
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
                              <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px', fontSize: '.85rem', fontWeight: 600 }}
                                disabled={ocrStates.bus.status !== 'confirmed' || submitLoading}
                                onClick={() => handleSubmitFee('bus')}>
                                {submitLoading ? 'Submitting...' : '🚀 Final Submit for Approval'}
                              </button>
                              {ocrStates.bus.status === 'confirmed' && (
                                <div style={{marginTop: 10, padding: 8, background: '#fffbeb', color: '#92400e', fontSize: '.75rem', borderRadius: 6, border: '1px solid #fde68a', textAlign: 'center'}}>
                                  ⚠️ One step left! Click the button above to send to your teacher.
                                </div>
                              )}
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
                  {hostelOpted ? getFeeBadge('hostel') : <span className="badge badge-neutral">Not Opted</span>}
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
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Student Name</label><span>{ocrStates.hostel.ocrData.name || '—'}</span></div>
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Department</label><span>{ocrStates.hostel.ocrData.department || '—'}</span></div>
                                <div className="ocr-field" style={{ gridColumn: '1 / -1' }}><label>Particulars</label><span>{ocrStates.hostel.ocrData.particulars || '—'}</span></div>
                                <div className="ocr-field"><label>Amount</label><span>{ocrStates.hostel.ocrData.amount || '—'}</span></div>
                                <div className="ocr-field"><label>Bank Name</label><span>{ocrStates.hostel.ocrData.bank || '—'}</span></div>
                                <div className="ocr-field"><label>Date</label><span>{ocrStates.hostel.ocrData.date || '—'}</span></div>
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
                            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px', fontSize: '.85rem', fontWeight: 600 }}
                              disabled={ocrStates.hostel.status !== 'confirmed' || submitLoading}
                              onClick={() => handleSubmitFee('hostel')}>
                              {submitLoading ? 'Submitting...' : '🚀 Submit Hostel Fee for Approval'}
                            </button>
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

            {clearanceRequests.length === 0 ? (
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
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 20 }}>
                {clearanceRequests.map(r => {
                  const teacherApproval = r.departmentApprovals?.find(a => a.department === 'class_teacher');
                  const isPending = r.overallStatus === 'submitted' || r.overallStatus === 'under_review';
                  const isApproved = r.overallStatus === 'approved';
                  const isRejected = r.overallStatus === 'rejected';

                  return (
                    <div key={r._id} className={`status-bar ${isApproved ? 'success' : isRejected ? 'danger' : 'pending'}`}>
                      <div className="sb-icon">
                        {isApproved ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : isRejected ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        )}
                      </div>
                      <div className="sb-info" style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ textTransform: 'capitalize' }}>{r.feeType} Fee Clearance</h3>
                            <div style={{display:'flex', gap:8, alignItems:'center'}}>
                              {r.receiptFile?.filename && (
                                <a href={`${API_ROOT}/uploads/${r.receiptFile?.filename}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" style={{padding:'2px 8px', fontSize:'.65rem'}}>
                                  View Receipt
                                </a>
                              )}
                              <span style={{ fontSize: '.75rem', opacity: 0.8 }}>ID: {r.requestNumber}</span>
                            </div>
                          </div>
                        <p style={{ margin: '4px 0' }}>
                          {isApproved ? 'All departments have approved your clearance!' : 
                           isRejected ? 'Your request was rejected. Please check remarks and re-submit.' : 
                           'Your request is currently being reviewed by your Class Teacher.'}
                        </p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                          <span className={`badge ${r.overallStatus === 'approved' ? 'badge-success' : r.overallStatus === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                            Overall: {r.overallStatus.replace('_', ' ')}
                          </span>
                          <span className="badge badge-neutral">Teacher: {teacherApproval?.status || 'pending'}</span>
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 5 }}>₹{r.ocrData?.amount?.replace('₹', '') || '0'}</div>
                        <div style={{ fontSize: '.7rem', color: 'var(--text-sub)' }}>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'Draft'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Final Clearance Certificate */}
            <div className="clearance-form-card">
              <div className="cf-header">
                <h3> Final Clearance Certificate</h3>
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
                      <th>Fee Category</th><th>Amount Due</th><th>Amount Paid</th><th>Payment Type</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── Tuition Fee Row ── */}
                    {(() => {
                      const req = clearanceRequests.find(r => r.feeType === 'tuition');
                      const amountDue = baseTuitionAmount > 0 ? `₹${baseTuitionAmount.toLocaleString()}` : '—';
                      const amountPaid = req?.ocrData?.amount || '—';
                      
                      const pType = req?.ocrData?.paymentType || (selectedTuitionCategory ? (isHalfTuition ? 'half' : 'full') : null);
                      const paymentTypeLabel = pType === 'half' ? 'Half Payment' : (pType === 'full' ? 'Full Payment' : '—');
                      
                      return (
                        <tr>
                          <td>Tuition Fee</td>
                          <td>{amountDue}</td>
                          <td>{amountPaid}</td>
                          <td>{paymentTypeLabel}</td>
                          <td>{getFeeBadge('tuition')}</td>
                        </tr>
                      );
                    })()}

                    {/* ── Bus Fee Row ── */}
                    {busOpted ? (() => {
                      const req = clearanceRequests.find(r => r.feeType === 'bus');
                      const busAmountDue = selectedSubLocation ? `₹${selectedSubLocation.fee.toLocaleString()}` : '—';
                      const busAmountPaid = req?.ocrData?.amount || '—';
                      
                      const pType = req?.ocrData?.paymentType || (selectedSubLocation ? (isHalfFee ? 'half' : 'full') : null);
                      const paymentTypeLabel = pType === 'half' ? 'Half Payment' : (pType === 'full' ? 'Full Payment' : '—');
                      
                      return (
                        <tr>
                          <td>Bus Fee</td>
                          <td>{busAmountDue}</td>
                          <td>{busAmountPaid}</td>
                          <td>{paymentTypeLabel}</td>
                          <td>{getFeeBadge('bus')}</td>
                        </tr>
                      );
                    })() : (
                      <tr>
                        <td>Bus Fee</td>
                        <td>Nil</td>
                        <td>Nil</td>
                        <td>Nil</td>
                        <td><span className="badge badge-neutral">Not Opted</span></td>
                      </tr>
                    )}

                    {/* ── Hostel Fee Row ── */}
                    {hostelOpted ? (() => {
                      const req = clearanceRequests.find(r => r.feeType === 'hostel');
                      const hostelAmountPaid = req?.ocrData?.amount || '—';
                      
                      return (
                        <tr>
                          <td>Hostel Fee</td>
                          <td>—</td>
                          <td>{hostelAmountPaid}</td>
                          <td>Full Payment</td>
                          <td>{getFeeBadge('hostel')}</td>
                        </tr>
                      );
                    })() : (
                      <tr>
                        <td>Hostel Fee</td>
                        <td>Nil</td>
                        <td>Nil</td>
                        <td>Nil</td>
                        <td><span className="badge badge-neutral">Not Opted</span></td>
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


          </div>
        </main>
      </div>
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  )
}
