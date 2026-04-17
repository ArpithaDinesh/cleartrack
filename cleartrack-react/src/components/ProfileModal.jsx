import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, login } = useAuth(); // login is actually setAuth, we might need a way to refresh user context
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Initialize form with existing user data
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    department: user?.department || '',
    classYear: user?.classYear || '',
    section: user?.section || '',
    universityNumber: user?.universityNumber || '',
    rollNumber: user?.rollNumber || '',
    admissionNumber: user?.admissionNumber || '',
    staffId: user?.staffId || '',
    assignedDepartment: user?.assignedDepartment || ''
  });

  if (!isOpen) return null;

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // Send updates to backend
      const res = await userAPI.updateProfile(form);
      
      // We need to update localStorage and context
      // Re-use the existing token from localStorage, just update user
      const token = localStorage.getItem('cleartrack_token');
      if (token && res.user) {
        // useAuth login usually takes (token, user) data. If their context provides something else, we can just reload for safety if needed.
        // Easiest reliable way:
        localStorage.setItem('cleartrack_user', JSON.stringify(res.user));
        window.location.reload(); // Quick dirty way to refresh all state
      } else {
        setSuccess('Profile updated successfully!');
        setTimeout(onClose, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: 'white', padding: '24px', borderRadius: '12px',
        width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Edit Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#d1fae5', color: '#047857', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.875rem' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Full Name</label>
            <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.fullName} onChange={set('fullName')} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Phone Number</label>
              <input type="tel" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.phone} onChange={set('phone')} />
            </div>

            {(user?.role === 'student' || user?.role === 'staff' || user?.role === 'admin') && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Department</label>
                <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }} value={form.department} onChange={set('department')}>
                  <option value="" disabled>Select Department</option>
                  <option value="CS">CS</option>
                  <option value="IT">IT</option>
                  <option value="CE">CE</option>
                  <option value="ME">ME</option>
                  <option value="EC">EC</option>
                  <option value="EEE">EEE</option>
                  <option value="MCA">MCA</option>
                  <option value="MBA">MBA</option>
                </select>
              </div>
            )}
            
            {user?.role === 'student' && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Class / Year</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.classYear} onChange={set('classYear')} />
              </div>
            )}
            
            {user?.role === 'student' && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Section</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.section} onChange={set('section')} />
              </div>
            )}
            
            {user?.role === 'student' && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>University Number</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.universityNumber} onChange={set('universityNumber')} />
              </div>
            )}
            
            {user?.role === 'student' && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Roll Number</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.rollNumber} onChange={set('rollNumber')} />
              </div>
            )}

            {user?.role === 'student' && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Admission Number</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.admissionNumber} onChange={set('admissionNumber')} />
              </div>
            )}

            {(user?.role === 'staff' || user?.role === 'admin') && (
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-sub)' }}>Staff ID</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }} value={form.staffId} onChange={set('staffId')} />
              </div>
            )}

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              Cancel
            </button>
            <button type="submit" style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: 'var(--teal)', color: '#fff', cursor: 'pointer', fontWeight: 500 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
