const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const ClearanceRequest = require('../models/ClearanceRequest');
const ApprovalLog = require('../models/ApprovalLog');
const { processOCRInternal } = require('./ocr.controller');

// Helper: build department approvals based on fee type and student profile
const buildApprovals = (feeType, student) => {
  const approvals = [];

  // Tuition always included
  if (feeType === 'full' || feeType === 'tuition') {
    approvals.push({ department: 'tuition', status: 'pending' });
  } else {
    approvals.push({ department: 'tuition', status: 'not_applicable' });
  }

  // Bus
  if ((feeType === 'full' || feeType === 'bus') && student.isBusUser) {
    approvals.push({ department: 'bus', status: 'pending' });
  } else {
    approvals.push({ department: 'bus', status: 'not_applicable' });
  }

  // Hostel
  if ((feeType === 'full' || feeType === 'hostel') && student.isHostelUser) {
    approvals.push({ department: 'hostel', status: 'pending' });
  } else {
    approvals.push({ department: 'hostel', status: 'not_applicable' });
  }

  // Exam
  if (feeType === 'full' || feeType === 'exam') {
    approvals.push({ department: 'exam', status: 'pending' });
  } else {
    approvals.push({ department: 'exam', status: 'not_applicable' });
  }

  // Class Teacher - ALWAYS REQUIRED
  approvals.push({ department: 'class_teacher', status: 'pending' });

  return approvals;
};

// @desc  Submit clearance request
// @route POST /api/clearance/submit
const submitRequest = async (req, res) => {
  try {
    const { feeType, semester, academicYear, studentNotes } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Receipt file is required.' });
    }

    const requestNumber = `CLR-${Date.now()}-${uuidv4().substr(0, 6).toUpperCase()}`;
    const approvals = buildApprovals(feeType, req.user);

    const request = await ClearanceRequest.create({
      student: req.user._id,
      requestNumber,
      feeType,
      semester,
      academicYear,
      studentNotes,
      receiptFile: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      },
      departmentApprovals: approvals,
      overallStatus: 'draft',
      submittedAt: null
    });

    await ApprovalLog.create({
      clearanceRequest: request._id,
      action: 'submitted',
      performedBy: req.user._id,
      newStatus: 'submitted'
    });

    // Automatically trigger OCR processing in the background
    // This makes the response instant while OCR runs silently
    request.ocrData = { ocrStatus: 'processing' };
    await request.save();

    // Trigger background process without awaiting
    processOCRInternal(request, req.user)
      .then(() => {
        console.log(`✅ Background OCR completed for ${request._id}`);
        // Update status to completed
        return ClearanceRequest.findByIdAndUpdate(request._id, { 'ocrData.ocrStatus': 'completed' });
      })
      .catch(err => {
        console.error(`❌ Background OCR failed for ${request._id}:`, err.message);
        return ClearanceRequest.findByIdAndUpdate(request._id, { 'ocrData.ocrStatus': 'failed' });
      });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Get student's own requests
// @route GET /api/clearance/my
const getMyRequests = async (req, res) => {
  try {
    const requests = await ClearanceRequest.find({ student: req.user._id })
      .sort({ createdAt: -1 })
      .populate('departmentApprovals.reviewedBy', 'fullName staffId');
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get single request
// @route GET /api/clearance/:id
const getRequest = async (req, res) => {
  try {
    const request = await ClearanceRequest.findById(req.params.id)
      .populate('student', 'fullName universityNumber rollNumber department classYear')
      .populate('departmentApprovals.reviewedBy', 'fullName staffId assignedDepartment');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    // Allow student to see own request, staff to see their dept, admin to see all
    if (req.user.role === 'student' && request.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get pending requests for staff department
// @route GET /api/clearance/department/pending
const getDepartmentPending = async (req, res) => {
  try {
    const dept = req.user.assignedDepartment;
    if (!dept) {
      return res.status(400).json({ success: false, message: 'No department assigned.' });
    }

    // First get all requests pending for this department
    const requests = await ClearanceRequest.find({
      'departmentApprovals': {
        $elemMatch: { department: dept, status: 'pending' }
      }
    })
      .sort({ submittedAt: 1 })
      .populate('student', 'fullName universityNumber rollNumber department classYear admissionNumber');

    // If class teacher: additionally filter by matching department AND year
    let filtered = requests;
    if (dept === 'class_teacher') {
      const { classDepartment, classYear } = req.user;
      if (classDepartment && classYear) {
        filtered = requests.filter(r =>
          r.student &&
          r.student.department === classDepartment &&
          r.student.classYear === classYear
        );
      } else {
        // Teacher has no class assigned - show nothing
        filtered = [];
      }
    }

    res.json({ success: true, requests: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Staff approve/reject a department in a request
// @route PATCH /api/clearance/:id/review
const reviewRequest = async (req, res) => {
  try {
    const { decision, remarks } = req.body; // decision: 'approved' | 'rejected'
    const dept = req.user.assignedDepartment;

    if (!dept) {
      return res.status(400).json({ success: false, message: 'No department assigned.' });
    }

    const request = await ClearanceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const approval = request.departmentApprovals.find(a => a.department === dept);
    if (!approval) {
      return res.status(400).json({ success: false, message: 'This department is not part of this request.' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has already been reviewed.' });
    }

    const prevStatus = request.overallStatus;
    approval.status = decision;
    approval.reviewedBy = req.user._id;
    approval.reviewedAt = new Date();
    approval.remarks = remarks || '';

    request.updateOverallStatus();
    await request.save();

    await ApprovalLog.create({
      clearanceRequest: request._id,
      action: decision,
      performedBy: req.user._id,
      department: dept,
      remarks: remarks || '',
      previousStatus: prevStatus,
      newStatus: request.overallStatus
    });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get all requests (admin)
// @route GET /api/clearance/admin/all
const getAllRequests = async (req, res) => {
  try {
    const { status, feeType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.overallStatus = status;
    if (feeType) filter.feeType = feeType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [requests, total] = await Promise.all([
      ClearanceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('student', 'fullName universityNumber rollNumber department classYear'),
      ClearanceRequest.countDocuments(filter)
    ]);

    res.json({ success: true, requests, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get approval logs for a request
// @route GET /api/clearance/:id/logs
const getRequestLogs = async (req, res) => {
  try {
    const logs = await ApprovalLog.find({ clearanceRequest: req.params.id })
      .populate('performedBy', 'fullName role staffId universityNumber')
      .sort({ createdAt: -1 });
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Submit all draft requests for approval
// @route POST /api/clearance/submit-all
const submitAllRequests = async (req, res) => {
  try {
    const result = await ClearanceRequest.updateMany(
      { student: req.user._id, overallStatus: 'draft' },
      { $set: { overallStatus: 'submitted', submittedAt: new Date() } }
    );

    res.json({ success: true, message: `${result.nModified} requests submitted for approval.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  submitRequest, getMyRequests, getRequest,
  getDepartmentPending, reviewRequest, getAllRequests, getRequestLogs,
  submitAllRequests
};
