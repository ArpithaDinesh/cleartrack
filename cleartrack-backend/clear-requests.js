const mongoose = require('mongoose');
require('dotenv').config();
const ClearanceRequest = require('./models/ClearanceRequest');
const ApprovalLog = require('./models/ApprovalLog');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const r1 = await ClearanceRequest.deleteMany({});
  const r2 = await ApprovalLog.deleteMany({});
  console.log(`✅ Deleted ${r1.deletedCount} clearance requests`);
  console.log(`✅ Deleted ${r2.deletedCount} approval logs`);
  console.log('🎉 Database is clean! Ready for fresh submissions.');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
