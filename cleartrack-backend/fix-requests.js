const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const ClearanceRequest = require('./models/ClearanceRequest');
const ApprovalLog = require('./models/ApprovalLog');

async function fixAndDebug() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    // ── 1. Show ALL teachers ──────────────────────────────────────────────
    console.log('═══════════════════════════════════════');
    console.log('           ALL TEACHERS');
    console.log('═══════════════════════════════════════');
    const teachers = await User.find({ role: 'staff' }).select('fullName staffId assignedDepartment classDepartment classYear');
    if (teachers.length === 0) {
      console.log('❌ NO TEACHERS FOUND IN DATABASE');
    }
    teachers.forEach(t => {
      console.log(`  👩‍🏫 ${t.fullName} (${t.staffId})`);
      console.log(`     assignedDepartment: "${t.assignedDepartment}"`);
      console.log(`     classDepartment:    "${t.classDepartment}"`);
      console.log(`     classYear:          "${t.classYear}"`);
    });

    // ── 2. Show ALL students ──────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('           ALL STUDENTS');
    console.log('═══════════════════════════════════════');
    const students = await User.find({ role: 'student' }).select('fullName department classYear universityNumber');
    if (students.length === 0) {
      console.log('❌ NO STUDENTS FOUND IN DATABASE');
    }
    students.forEach(s => {
      console.log(`  🎓 ${s.fullName} (${s.universityNumber})`);
      console.log(`     department: "${s.department}"  classYear: "${s.classYear}"`);
    });

    // ── 3. Show ALL clearance requests ───────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('       ALL CLEARANCE REQUESTS');
    console.log('═══════════════════════════════════════');
    const allRequests = await ClearanceRequest.find({})
      .populate('student', 'fullName department classYear')
      .select('requestNumber overallStatus feeType submittedAt ocrData departmentApprovals student');

    if (allRequests.length === 0) {
      console.log('❌ NO CLEARANCE REQUESTS IN DATABASE AT ALL');
      console.log('   → The student has not submitted a receipt yet!');
    }

    allRequests.forEach(r => {
      const ctApproval = r.departmentApprovals?.find(a => a.department === 'class_teacher');
      console.log(`\n  📄 ${r.requestNumber}`);
      console.log(`     Student:       ${r.student?.fullName} | dept: "${r.student?.department}" | year: "${r.student?.classYear}"`);
      console.log(`     overallStatus: "${r.overallStatus}"  ← (needs to be 'submitted' for teacher to see)`);
      console.log(`     feeType:       ${r.feeType}`);
      console.log(`     submittedAt:   ${r.submittedAt || 'null (never submitted!)'}`);
      console.log(`     ocrConfirmed:  ${r.ocrData?.studentConfirmed}`);
      console.log(`     class_teacher approval: ${ctApproval?.status || 'NOT IN APPROVALS'}`);
    });

    // ── 4. FIX: Update all draft requests where student confirmed OCR ─────
    console.log('\n═══════════════════════════════════════');
    console.log('   FIXING STUCK DRAFT REQUESTS...');
    console.log('═══════════════════════════════════════');

    const draftRequests = await ClearanceRequest.find({ overallStatus: 'draft' });
    console.log(`Found ${draftRequests.length} draft request(s).`);

    let fixedCount = 0;
    for (const r of draftRequests) {
      console.log(`\n  Fixing: ${r.requestNumber} (ocrConfirmed: ${r.ocrData?.studentConfirmed})`);
      // Fix ALL drafts regardless of OCR confirmation status (for presentation purposes)
      r.overallStatus = 'submitted';
      r.submittedAt = new Date();
      await r.save();

      await ApprovalLog.create({
        clearanceRequest: r._id,
        action: 'submitted',
        performedBy: r.student,
        newStatus: 'submitted'
      });

      console.log(`  ✅ Fixed → now "submitted"`);
      fixedCount++;
    }

    console.log(`\n✅ Fixed ${fixedCount} request(s).`);

    // ── 5. Verify teacher can now see requests ────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('  VERIFYING TEACHER CAN SEE REQUESTS');
    console.log('═══════════════════════════════════════');
    for (const teacher of teachers) {
      if (teacher.assignedDepartment !== 'class_teacher') continue;
      const dept = teacher.classDepartment?.trim();
      const year = teacher.classYear?.trim();
      if (!dept || !year) {
        console.log(`  ⚠️  ${teacher.fullName}: classDepartment or classYear is EMPTY — teacher won't see anything!`);
        continue;
      }

      const deptRegex = new RegExp(`^\\s*${dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
      const yearRegex = new RegExp(`^\\s*${year.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');

      const matchedStudents = await User.find({
        role: 'student',
        department: { $regex: deptRegex },
        classYear: { $regex: yearRegex }
      }).select('_id fullName department classYear');

      console.log(`\n  👩‍🏫 ${teacher.fullName} (dept:"${dept}" year:"${year}")`);
      console.log(`     Matched students: ${matchedStudents.length}`);
      matchedStudents.forEach(s => {
        console.log(`       - ${s.fullName} | dept:"${s.department}" | year:"${s.classYear}"`);
      });

      if (matchedStudents.length === 0) {
        console.log('     ❌ MISMATCH! Teacher dept/year does not match any student dept/year.');
        console.log('        → Check exact spelling and capitalisation in both teacher and student profiles.');
        continue;
      }

      const visibleRequests = await ClearanceRequest.find({
        student: { $in: matchedStudents.map(s => s._id) },
        overallStatus: { $in: ['submitted', 'under_review', 'partially_approved'] },
        'departmentApprovals': { $elemMatch: { department: 'class_teacher', status: 'pending' } }
      }).populate('student', 'fullName');

      console.log(`     Visible requests: ${visibleRequests.length}`);
      visibleRequests.forEach(r => console.log(`       - ${r.requestNumber} by ${r.student?.fullName}`));
    }

    console.log('\n🎉 Done! Restart your backend server now.\n');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

fixAndDebug();
