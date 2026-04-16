const mongoose = require('mongoose');

const approvalLogSchema = new mongoose.Schema({
  clearanceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClearanceRequest',
    required: true
  },
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'resubmitted', 'ocr_processed'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: { type: String, default: null },
  remarks: { type: String, default: '' },
  previousStatus: { type: String, default: null },
  newStatus: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('ApprovalLog', approvalLogSchema);
