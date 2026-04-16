const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// @desc  Register new user (student)
// @route POST /api/auth/register/student
const registerStudent = async (req, res) => {
  try {
    const { fullName, email, password, phone, universityNumber, rollNumber,
      admissionNumber, department, classYear, section, isBusUser, isHostelUser } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      fullName, email, password, phone, role: 'student',
      universityNumber, rollNumber, admissionNumber, department,
      classYear, section, isBusUser, isHostelUser
    });

    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Register staff (admin only)
// @route POST /api/auth/register/staff
const registerStaff = async (req, res) => {
  try {
    const { fullName, email, password, phone, staffId, department, assignedDepartment } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      fullName, email, password, phone, role: 'staff',
      staffId, department, assignedDepartment
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Public registration for staff/admin (college project use)
// @route POST /api/auth/register/staff-public
const registerStaffPublic = async (req, res) => {
  try {
    const { fullName, email, password, phone, staffId, department, role, assignedDepartment, classDepartment, classYear } = req.body;

    if (!['staff', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be staff or admin.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({
      fullName, email, password, phone, role, staffId, department,
      assignedDepartment: assignedDepartment || null,
      classDepartment: classDepartment || null,
      classYear: classYear || null
    });

    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Login
// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email, role }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const token = generateToken(user._id);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get current user
// @route GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { registerStudent, registerStaff, registerStaffPublic, login, getMe };
