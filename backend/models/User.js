// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['student', 'admin', 'CR'], default: 'student' },
  // Add other fields as necessary
});

module.exports = mongoose.model('User', userSchema);
