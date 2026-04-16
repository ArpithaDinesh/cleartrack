const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const User = require('../models/User');

// Get staff list for a department
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { assignedDepartment } = req.query;
    const filter = { role: 'staff' };
    if (assignedDepartment) filter.assignedDepartment = assignedDepartment;
    const staff = await User.find(filter);
    res.json({ success: true, staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
