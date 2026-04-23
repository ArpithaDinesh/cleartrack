const mongoose = require('mongoose');

const tuitionFeeSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
    enum: ['First year', 'Second year', 'Third year', 'Fourth year'],
    unique: true
  },
  meritReg: { type: Number, default: 0 },
  meritFull: { type: Number, default: 0 },
  tfw: { type: Number, default: 0 },
  nri: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('TuitionFee', tuitionFeeSchema);
