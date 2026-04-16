const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['student', 'staff', 'admin'],
    default: 'student'
  },
  // Student-specific fields
  universityNumber: { type: String, trim: true },
  rollNumber: { type: String, trim: true },
  admissionNumber: { type: String, trim: true },
  department: { type: String, trim: true },
  classYear: { type: String, trim: true },
  section: { type: String, trim: true },
  isBusUser: { type: Boolean, default: false },
  isHostelUser: { type: Boolean, default: false },
  // Staff-specific fields
  staffId: { type: String, trim: true },
  assignedDepartment: {
    type: String,
    enum: ['tuition', 'bus', 'hostel', 'exam', 'class_teacher', null, ''],
    default: null
  },
  // Class teacher specific fields
  classDepartment: { type: String, trim: true, default: null },
  classYear: { type: String, trim: true, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
