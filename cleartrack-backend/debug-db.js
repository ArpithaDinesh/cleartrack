const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const ClearanceRequest = require('./models/ClearanceRequest');

async function check() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ DB Connected');

    const teacher = await User.findOne({ fullName: 'teacher2' });
    if (!teacher) {
      console.log('Teacher teacher2 not found!');
      process.exit(1);
    }

    console.log('Teacher Profile:', {
      assignedDepartment: teacher.assignedDepartment,
      classDepartment: teacher.classDepartment,
      classYear: teacher.classYear
    });

    const dept = teacher.assignedDepartment;
    const classDepartment = teacher.classDepartment;
    const classYear = teacher.classYear;

    const query = {
      overallStatus: { $ne: 'draft' },
      'departmentApprovals': {
        $elemMatch: { department: dept, status: 'pending' }
      }
    };

    if (dept === 'class_teacher') {
      const studentIds = await User.find({
        role: 'student',
        department: { $regex: new RegExp(`^${classDepartment}$`, 'i') },
        classYear: { $regex: new RegExp(`^${classYear}$`, 'i') }
      }).distinct('_id');

      console.log('Matched Student IDs:', studentIds.length);
      query.student = { $in: studentIds };
    }

    console.log('Final MongoDB Query:', JSON.stringify(query));

    const requests = await ClearanceRequest.find(query).populate('student');
    console.log('Found Requests:', requests.length);

    requests.forEach(r => {
      console.log(`- ${r.requestNumber} for student ${r.student?.fullName}`);
    });

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

check();
