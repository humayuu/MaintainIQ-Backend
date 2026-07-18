import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // never returned by default; hashing belongs in a service/auth hook (later phase)
  },
  role: {
    type: String,
    enum: ['admin', 'technician', 'supervisor'],
    required: true,
  },
  // Optional Cloudinary URL for the user's profile photo. Empty string = no
  // avatar (the UI falls back to an initial). Uploaded via /api/uploads.
  avatarUrl: {
    type: String,
    default: '',
    trim: true,
  },
  // Email verification (Phase 1: non-blocking — used for a "verify your email"
  // banner, NOT to gate login). Existing users predate this field, so it will
  // read as `undefined` for them; the UI only nags when it is explicitly false.
  emailVerified: {
    type: Boolean,
    default: false,
  },
  // Single-use verification token + expiry. `select: false` so they never leak
  // in normal queries or API responses.
  verificationToken: {
    type: String,
    select: false,
  },
  verificationTokenExpiresAt: {
    type: Date,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
