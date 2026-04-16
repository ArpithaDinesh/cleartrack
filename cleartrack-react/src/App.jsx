import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LoginStudent from './pages/auth/LoginStudent'
import LoginTeacher from './pages/auth/LoginTeacher'
import LoginAdmin from './pages/auth/LoginAdmin'
import RegisterStudent from './pages/auth/RegisterStudent'
import RegisterTeacher from './pages/auth/RegisterTeacher'
import RegisterAdmin from './pages/auth/RegisterAdmin'
import StudentDashboard from './pages/dashboards/StudentDashboard'
import TeacherDashboard from './pages/dashboards/TeacherDashboard'
import AdminDashboard from './pages/dashboards/AdminDashboard'
import UploadReceipt from './pages/student/UploadReceipt'
import OCRConfirm from './pages/student/OCRConfirm'
import ClearanceStatus from './pages/student/ClearanceStatus'
import RequestHistory from './pages/student/RequestHistory'
import StaffPending from './pages/staff/StaffPending'
import RequestDetail from './pages/staff/RequestDetail'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login/student" replace />} />
          {/* Auth */}
          <Route path="/login/student" element={<LoginStudent />} />
          <Route path="/login/teacher" element={<LoginTeacher />} />
          <Route path="/login/admin" element={<LoginAdmin />} />
          <Route path="/register/student" element={<RegisterStudent />} />
          <Route path="/register/teacher" element={<RegisterTeacher />} />
          <Route path="/register/admin" element={<RegisterAdmin />} />
          {/* Student */}
          <Route path="/dashboard/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/upload-receipt" element={<ProtectedRoute role="student"><UploadReceipt /></ProtectedRoute>} />
          <Route path="/ocr-confirm/:requestId" element={<ProtectedRoute role="student"><OCRConfirm /></ProtectedRoute>} />
          <Route path="/clearance-status" element={<ProtectedRoute role="student"><ClearanceStatus /></ProtectedRoute>} />
          <Route path="/request-history" element={<ProtectedRoute role="student"><RequestHistory /></ProtectedRoute>} />
          {/* Staff */}
          <Route path="/dashboard/teacher" element={<ProtectedRoute role="staff"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/staff/pending" element={<ProtectedRoute role="staff"><StaffPending /></ProtectedRoute>} />
          <Route path="/staff/request/:id" element={<ProtectedRoute role="staff"><RequestDetail /></ProtectedRoute>} />
          {/* Admin */}
          <Route path="/dashboard/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
