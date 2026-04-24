const mongoose = require('mongoose');

const departmentApprovalSchema = new mongoose.Schema({
  department: {
    type: String,
    enum: ['tuition', 'bus', 'hostel', 'exam', 'class_teacher'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_applicable'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: { type: Date, default: null },
  remarks: { type: String, default: '' }
});

const ocrDataSchema = new mongoose.Schema({
  studentName: { type: String, default: '' },
  department: { type: String, default: '' },
  feeCategory: { type: String, default: '' },
  transactionId: { type: String, default: '' },
  amount: { type: String, default: '' },
  paymentDate: { type: String, default: '' },
  receiptNumber: { type: String, default: '' },
  bankName: { type: String, default: '' },
  paymentMode: { type: String, default: '' },
  paymentType: { type: String, default: '' }, // 'half' or 'full'
  rawText: { type: String, default: '' },
  ocrStatus: {
    type: String,
    enum: ['idle', 'processing', 'completed', 'failed'],
    default: 'idle'
  },
  studentConfirmed: { type: Boolean, default: false },
  confirmedAt: { type: Date, default: null }
});

const clearanceRequestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestNumber: {
    type: String,
    unique: true,
    required: true
  },
  semester: { type: String, default: '' },
  academicYear: { type: String, default: '' },
  feeType: {
    type: String,
    enum: ['tuition', 'bus', 'hostel', 'exam', 'full'],
    required: true
  },
  receiptFile: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String
  },
  ocrData: ocrDataSchema,
  departmentApprovals: [departmentApprovalSchema],
  overallStatus: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'partially_approved', 'approved', 'rejected'],
    default: 'draft'
  },
  submittedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  studentNotes: { type: String, default: '' }
}, { timestamps: true });

// Auto-update overall status based on department approvals
clearanceRequestSchema.methods.updateOverallStatus = function() {
  const approvals = this.departmentApprovals.filter(a => a.status !== 'not_applicable');
  if (approvals.length === 0) return;

  const allApproved = approvals.every(a => a.status === 'approved');
  const anyRejected = approvals.some(a => a.status === 'rejected');
  const anyPending = approvals.some(a => a.status === 'pending');

  if (allApproved) {
    this.overallStatus = 'approved';
    this.completedAt = new Date();
  } else if (anyRejected) {
    this.overallStatus = 'rejected';
  } else if (anyPending && approvals.some(a => a.status === 'approved')) {
    this.overallStatus = 'partially_approved';
  } else {
    this.overallStatus = 'under_review';
  }
};

module.exports = mongoose.model('ClearanceRequest', clearanceRequestSchema);
