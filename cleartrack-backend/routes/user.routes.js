const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User');

// @desc  Get current user's profile
router.get('/profile', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @desc  Update current user's profile
router.patch('/profile', protect, async (req, res) => {
  try {
    const allowed = ['fullName', 'phone', 'section', 'universityNumber', 'rollNumber', 'admissionNumber', 'department', 'classYear', 'staffId', 'assignedDepartment'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @desc  Get students assigned to this teacher (class teacher)
router.get('/my-students', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied. Teachers only.' });
    }

    const { classDepartment, classYear } = req.user;
    if (!classDepartment || !classYear) {
      return res.json({ success: true, students: [] });
    }

    const students = await User.find({
      role: 'student',
      department: classDepartment,
      classYear: classYear
    }).select('fullName email phone universityNumber rollNumber admissionNumber section isActive');

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
