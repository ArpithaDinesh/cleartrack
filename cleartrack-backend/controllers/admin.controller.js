const User = require('../models/User');
const ClearanceRequest = require('../models/ClearanceRequest');
const ApprovalLog = require('../models/ApprovalLog');

// @desc  Get dashboard stats
// @route GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [totalStudents, totalStaff, totalRequests, approved, pending, rejected] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'staff' }),
      ClearanceRequest.countDocuments(),
      ClearanceRequest.countDocuments({ overallStatus: 'approved' }),
      ClearanceRequest.countDocuments({ overallStatus: { $nin: ['approved', 'rejected'] } }), // everything in-progress
      ClearanceRequest.countDocuments({ overallStatus: 'rejected' })
    ]);
    res.json({ success: true, stats: { totalStudents, totalStaff, totalRequests, approved, pending, rejected } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get all users
// @route GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, users, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Activate/deactivate user
// @route PATCH /api/admin/users/:id/toggle
const toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Create staff account
// @route POST /api/admin/staff
const createStaff = async (req, res) => {
  try {
    const { fullName, email, password, phone, staffId, department, assignedDepartment } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });
    const user = await User.create({ fullName, email, password, phone, role: 'staff', staffId, department, assignedDepartment });
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Get recent activity logs
// @route GET /api/admin/logs
const getLogs = async (req, res) => {
  try {
    const logs = await ApprovalLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('performedBy', 'fullName role')
      .populate('clearanceRequest', 'requestNumber feeType');
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStats, getUsers, toggleUser, createStaff, getLogs };
