const express = require('express');
const router = express.Router();
const { registerStudent, registerStaff, registerStaffPublic, login, getMe } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.post('/register/student', registerStudent);
router.post('/register/staff', protect, authorize('admin'), registerStaff);
router.post('/register/staff-public', registerStaffPublic);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
