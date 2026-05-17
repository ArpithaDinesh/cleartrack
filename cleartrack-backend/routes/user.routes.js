const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User');

const ClearanceRequest = require('../models/ClearanceRequest');

// @desc  Get current user's profile
router.get('/profile', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @desc  Update current user's profile
router.patch('/profile', protect, async (req, res) => {
  try {
    const allowed = ['fullName', 'phone', 'section', 'universityNumber', 'rollNumber', 'admissionNumber', 'department', 'classYear', 'staffId', 'assignedDepartment', 'classDepartment'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Auto-fix: if staff sets classDepartment but has no assignedDepartment, auto-set to class_teacher
    if (req.user.role === 'staff' && updates.classDepartment && !updates.assignedDepartment) {
      const current = await User.findById(req.user._id).select('assignedDepartment');
      if (!current.assignedDepartment || current.assignedDepartment === '') {
        updates.assignedDepartment = 'class_teacher';
      }
    }

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

    const classDepartment = (req.user.classDepartment || '').trim();
    const classYear = (req.user.classYear || '').trim();
    
    if (!classDepartment || !classYear) {
      return res.json({ success: true, students: [] });
    }

    // High-Flexibility matching (handles variations like "4th Year" vs "Fourth year", CS vs Computer Science)
    const yearPatterns = { '1': '(1st|First|1)', '2': '(2nd|Second|2)', '3': '(3rd|Third|3)', '4': '(4th|Fourth|4)' };
    const yearNum = classYear.match(/\d/)?.[0] || 
                    (classYear.toLowerCase().includes('first') ? '1' : 
                     classYear.toLowerCase().includes('second') ? '2' : 
                     classYear.toLowerCase().includes('third') ? '3' : 
                     classYear.toLowerCase().includes('fourth') ? '4' : null);
    const yearRegex = yearNum ? new RegExp(`^\\s*${yearPatterns[yearNum]}`, 'i') : new RegExp(`^\\s*${classYear}\\s*$`, 'i');

    const getFuzzyDeptPattern = (dept) => {
      const d = dept.trim().toUpperCase();
      if (d === 'CS' || d.includes('COMPUTER')) return '(CS|Computer\\s*Science)';
      if (d === 'IT' || d.includes('INFORMATION')) return '(IT|Information\\s*Technology)';
      if (d === 'ME' || d.includes('MECHANICAL')) return '(ME|Mechanical)';
      if (d === 'CE' || d.includes('CIVIL')) return '(CE|Civil)';
      if (d === 'EC' || d.includes('ELECTRONICS')) return '(EC|Electronics)';
      if (d === 'EEE' || d.includes('ELECTRICAL')) return '(EEE|Electrical)';
      return dept.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    const deptRegex = new RegExp(`^\\s*${getFuzzyDeptPattern(classDepartment)}`, 'i');

    const studentsRaw = await User.find({
      role: 'student',
      department: { $regex: deptRegex },
      classYear: { $regex: yearRegex }
    }).select('fullName email phone universityNumber rollNumber admissionNumber section isActive isBusUser isHostelUser');

    const students = await Promise.all(studentsRaw.map(async (student) => {
      const requests = await ClearanceRequest.find({ student: student._id });
      
      const tuitionReq = requests.find(r => r.feeType === 'tuition');
      const tuitionCleared = tuitionReq?.departmentApprovals?.find(a => a.department === 'class_teacher')?.status === 'approved';

      const busReq = requests.find(r => r.feeType === 'bus');
      const busCleared = !student.isBusUser || (busReq?.departmentApprovals?.find(a => a.department === 'class_teacher')?.status === 'approved');

      const hostelReq = requests.find(r => r.feeType === 'hostel');
      const hostelCleared = !student.isHostelUser || (hostelReq?.departmentApprovals?.find(a => a.department === 'class_teacher')?.status === 'approved');

      const isFullyCleared = tuitionCleared && busCleared && hostelCleared;

      return {
        ...student.toObject(),
        clearanceStatus: isFullyCleared ? 'clearance_granted' : 'pending'
      };
    }));

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
