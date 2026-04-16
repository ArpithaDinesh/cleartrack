const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  submitRequest, getMyRequests, getRequest,
  getDepartmentPending, reviewRequest, getAllRequests, getRequestLogs,
  submitAllRequests
} = require('../controllers/clearance.controller');

// Student routes
router.post('/submit', protect, authorize('student'), upload.single('receipt'), submitRequest);
router.post('/submit-all', protect, authorize('student'), submitAllRequests);
router.get('/my', protect, authorize('student'), getMyRequests);

// Staff routes
router.get('/department/pending', protect, authorize('staff'), getDepartmentPending);
router.patch('/:id/review', protect, authorize('staff'), reviewRequest);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllRequests);

// Shared: student (own), staff, admin
router.get('/:id', protect, getRequest);
router.get('/:id/logs', protect, getRequestLogs);

module.exports = router;
