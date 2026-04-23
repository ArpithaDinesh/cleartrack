const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getStats, getUsers, toggleUser, createStaff, getLogs, deleteLog } = require('../controllers/admin.controller');

router.get('/stats', protect, authorize('admin'), getStats);
router.get('/users', protect, authorize('admin'), getUsers);
router.patch('/users/:id/toggle', protect, authorize('admin'), toggleUser);
router.post('/staff', protect, authorize('admin'), createStaff);
router.get('/logs', protect, authorize('admin'), getLogs);
router.delete('/logs/:id', protect, authorize('admin'), deleteLog);

module.exports = router;
