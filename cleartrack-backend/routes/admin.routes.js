const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getStats, getUsers, toggleUser, getLogs } = require('../controllers/admin.controller');

router.get('/stats', protect, authorize('admin'), getStats);
router.get('/users', protect, authorize('admin'), getUsers);
router.patch('/users/:id/toggle', protect, authorize('admin'), toggleUser);
router.get('/logs', protect, authorize('admin'), getLogs);

module.exports = router;
