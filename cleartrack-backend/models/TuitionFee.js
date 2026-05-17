const mongoose = require('mongoose');

const tuitionFeeSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
    enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    unique: true
  },
  meritReg: { type: Number, default: 0 },
  meritFull: { type: Number, default: 0 },
  tfw: { type: Number, default: 0 },
  nri: { type: Number, default: 0 },
  hostelFee: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('TuitionFee', tuitionFeeSchema);
