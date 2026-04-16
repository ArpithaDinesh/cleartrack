const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cleartrack';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB, checking for admin...');
    const adminEmail = 'admin@cleartrack.com';
    let admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
        admin.password = 'password123'; // Reset password just in case
        admin.role = 'admin';
        await admin.save();
        console.log('Existing Admin found and updated.');
    } else {
        await User.create({
          fullName: 'Super Admin',
          email: adminEmail,
          password: 'password123',
          role: 'admin'
        });
        console.log('New Admin created successfully!');
    }
    
    console.log('=============================');
    console.log('Login Email: admin@cleartrack.com');
    console.log('Login Password: password123');
    console.log('Role: Admin');
    console.log('=============================');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
