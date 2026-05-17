const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected!\n');

  // Show all staff before fix
  const allStaff = await User.find({ role: 'staff' }).select('fullName staffId assignedDepartment classDepartment classYear email');
  console.log('ALL STAFF BEFORE FIX:');
  allStaff.forEach(t => {
    console.log(`  ${t.fullName} | assigned:"${t.assignedDepartment}" | classDept:"${t.classDepartment}" | classYear:"${t.classYear}"`);
  });

  // Fix all staff that have empty/null assignedDepartment but have classDepartment set
  // These are class teachers who got saved without the role
  const fixed = await User.updateMany(
    { role: 'staff', assignedDepartment: { $in: ['', null] }, classDepartment: { $nin: ['', null] } },
    { $set: { assignedDepartment: 'class_teacher' } }
  );
  console.log('\nFixed teachers with missing assignedDepartment:', fixed.modifiedCount);

  // Show all staff after fix
  const allStaffAfter = await User.find({ role: 'staff' }).select('fullName staffId assignedDepartment classDepartment classYear');
  console.log('\nALL STAFF AFTER FIX:');
  allStaffAfter.forEach(t => {
    console.log(`  ${t.fullName} | assigned:"${t.assignedDepartment}" | classDept:"${t.classDepartment}" | classYear:"${t.classYear}"`);
  });

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
