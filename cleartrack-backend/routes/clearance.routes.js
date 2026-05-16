const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const { protect, authorize } = require('../middleware/auth.middleware');
const User = require('../models/User');
const ClearanceRequest = require('../models/ClearanceRequest');
const {
  submitRequest, getMyRequests, getRequest,
  getDepartmentPending, reviewRequest, getAllRequests, getRequestLogs,
  submitAllRequests, submitDraft, confirmOCR
} = require('../controllers/clearance.controller');

// Student routes
router.post('/submit', protect, authorize('student'), upload.single('receipt'), submitRequest);
router.post('/submit-all', protect, authorize('student'), submitAllRequests);
router.post('/:id/submit', protect, authorize('student'), submitDraft);
router.get('/my', protect, authorize('student'), getMyRequests);
router.patch('/:id/confirm', protect, authorize('student'), confirmOCR);

// Staff routes
router.get('/department/debug', protect, authorize('staff'), async (req, res) => {
  try {
    const { assignedDepartment, classDepartment, classYear } = req.user;
    const studentIds = classDepartment && classYear ? await User.find({
      role: 'student',
      department: { $regex: new RegExp(`^${classDepartment}$`, 'i') },
      classYear: { $regex: new RegExp(`^${classYear}$`, 'i') }
    }).distinct('_id') : [];
    const allSubmitted = await ClearanceRequest.find({ overallStatus: { $ne: 'draft' } })
      .populate('student', 'fullName department classYear').select('overallStatus feeType student departmentApprovals');
    res.json({ success: true, teacherProfile: { assignedDepartment, classDepartment, classYear }, matchedStudentCount: studentIds.length, allSubmittedRequests: allSubmitted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/department/pending', protect, authorize('staff'), getDepartmentPending);
router.patch('/:id/review', protect, authorize('staff'), reviewRequest);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllRequests);

// Shared: student (own), staff, admin
router.get('/:id', protect, getRequest);
router.get('/:id/logs', protect, getRequestLogs);

module.exports = router;
