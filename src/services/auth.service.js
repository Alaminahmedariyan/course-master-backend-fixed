// authentication service

const bcrypt = require("bcrypt");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendWelcomeEmail } = require("./email.service");

const register = async ({ name, email, password, adminKey }) => {
  const exists = await User.findOne({ email });
  if (exists) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);

  // FIX (BUG-007): the role is never taken from the request. A user becomes
  // admin only when the correct ADMIN_REGISTRATION_KEY is supplied.
  let role = "student";
  if (adminKey) {
    const serverKey = process.env.ADMIN_REGISTRATION_KEY;
    if (!serverKey || adminKey !== serverKey) {
      throw new Error("Invalid admin registration key");
    }
    role = "admin";
  }

  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
  });

  const token = generateToken({ id: user._id, role: user.role });

  // Send welcome email (non-blocking - don't wait for it)
  sendWelcomeEmail(user.email, user.name).catch(err => {
    console.error('Email sending failed (non-critical):', err.message);
  });

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("Invalid email or password");

  // FIX (BUG-002): passwords are stored as bcrypt hashes, so they must be
  // compared with bcrypt.compare instead of plain equality.
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new Error("Invalid email or password");

  // FIX (BUG-011): banned users must not be able to log in.
  if (user.isBanned) throw new Error("Your account has been banned");

  const token = generateToken({ id: user._id, role: user.role });

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash");
  if (!user) throw new Error("User not found");
  return user;
};

module.exports = { register, login, getMe };