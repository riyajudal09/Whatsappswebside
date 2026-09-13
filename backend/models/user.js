const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, default: null },
  phoneSuffix: { type: String, default: null },
  fullPhoneNumber: { type: String, unique: true, sparse: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true,
    validate: {
      validator(value) {
        return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Invalid email address format',
    },
  },
  passwordHash: { type: String, default: null, select: false },
  username: { type: String, trim: true, default: '' },
  profilepicture: { type: String, default: '' },
  about: { type: String, trim: true, default: 'Hey there! I am using WhatsApp Clone.' },
  isverified: { type: Boolean, default: false },
  agreed: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
