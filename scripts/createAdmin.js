// scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log('Mongo connected');

    const email = process.argv[2] || 'admin@example.com';
    const username = process.argv[3] || 'admin';
    const password = process.argv[4] || 'admin123';

    const exists = await User.findOne({ email });
    if (exists) {
      console.log(`User with email ${email} already exists`);
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const admin = await User.create({ username, email, password: hash, role: 'admin' });
    console.log('Admin created:', admin._id.toString());
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
