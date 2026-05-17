const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const teachers = await User.find({ role: 'staff' }).select('fullName staffId assignedDepartment classDepartment classYear email');
  console.log('TEACHERS IN DB:');
  for (const t of teachers) {
    console.log(`--- Teacher: ${t.fullName} (${t.email}) ---`);
    console.log(`Assigned: ${t.assignedDepartment} | classDept: ${t.classDepartment} | classYear: ${t.classYear}`);
    
    const classDepartment = (t.classDepartment || '').trim();
    const classYear = (t.classYear || '').trim();
    if (classDepartment && classYear) {
      const deptRegexExact = new RegExp(`^\\s*${classDepartment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
      const yearRegexExact = new RegExp(`^\\s*${classYear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
      
      const exactMatches = await User.find({
        role: 'student',
        department: { $regex: deptRegexExact },
        classYear: { $regex: yearRegexExact }
      }).select('fullName department classYear');
      console.log('Exact Matches count:', exactMatches.length);
      exactMatches.forEach(s => console.log(' -', s.fullName, '(', s.department, ',', s.classYear, ')'));
    }
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
