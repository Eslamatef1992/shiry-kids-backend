const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin, User } = require('../models');
const { sendPasswordResetEmail } = require('../utils/email');

const sign = (id, type, secret = process.env.JWT_SECRET, exp = process.env.JWT_EXPIRES_IN) =>
  jwt.sign({ id, type }, secret, { expiresIn: exp });

// Admin login
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ where: { email }, include: ['role'] });
    if (!admin || !await bcrypt.compare(password, admin.password))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (admin.status !== 'active')
      return res.status(403).json({ success: false, message: 'Account inactive' });
    const token = sign(admin.id, 'admin');
    const refresh = sign(admin.id, 'admin', process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES_IN);
    res.json({ success: true, token, refresh, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// User register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (await User.findOne({ where: { email } }))
      return res.status(409).json({ success: false, message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, phone, password: hash });
    const token = sign(user.id, 'user');
    const refresh = sign(user.id, 'user', process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES_IN);
    res.status(201).json({ success: true, token, refresh, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// User login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !await bcrypt.compare(password, user.password))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.status === 'banned')
      return res.status(403).json({ success: false, message: 'Account banned' });
    const token = sign(user.id, 'user');
    const refresh = sign(user.id, 'user', process.env.JWT_REFRESH_SECRET, process.env.JWT_REFRESH_EXPIRES_IN);
    res.json({ success: true, token, refresh, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Refresh token
exports.refresh = async (req, res) => {
  try {
    const { refresh } = req.body;
    const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const token = sign(decoded.id, decoded.type);
    res.json({ success: true, token });
  } catch { res.status(401).json({ success: false, message: 'Invalid refresh token' }); }
};

// Get profile (user)
exports.me = async (req, res) => {
  res.json({ success: true, user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, address: req.user.address, avatar: req.user.avatar } });
};

// Update profile (user) — name / phone / address
exports.updateMe = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    await req.user.update(data);
    res.json({ success: true, user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, address: req.user.address, avatar: req.user.avatar } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Update profile photo (user)
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    await req.user.update({ avatar: `/uploads/${req.file.filename}` });
    res.json({ success: true, user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, address: req.user.address, avatar: req.user.avatar } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.adminMe = async (req, res) => {
  res.json({ success: true, admin: { id: req.admin.id, name: req.admin.name, email: req.admin.email, role: req.admin.role } });
};

// ── Forgot / reset password ───────────────────────────────────────────────────
const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Request a password-reset code. Always responds with success (even if the
// email isn't registered) so we don't leak which emails have accounts.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (user) {
      const code = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit code
      const hash = await bcrypt.hash(code, 10);
      await user.update({
        password_reset_code: hash,
        password_reset_expires: new Date(Date.now() + RESET_CODE_TTL_MS),
      });
      await sendPasswordResetEmail(user, code);
    }
    res.json({ success: true, message: 'If this email is registered, a verification code has been sent.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Verify a reset code without consuming it (used by the OTP screen to give
// immediate feedback before the user sets a new password).
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: 'Email and code are required' });

    const user = await User.findOne({ where: { email } });
    const valid = !!user
      && user.password_reset_code
      && user.password_reset_expires
      && new Date(user.password_reset_expires) > new Date()
      && await bcrypt.compare(String(code), user.password_reset_code);

    if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    res.json({ success: true, message: 'Code verified' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Verify the reset code and set a new password.
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) return res.status(400).json({ success: false, message: 'Email, code and password are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ where: { email } });
    const valid = !!user
      && user.password_reset_code
      && user.password_reset_expires
      && new Date(user.password_reset_expires) > new Date()
      && await bcrypt.compare(String(code), user.password_reset_code);

    if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired code' });

    const hash = await bcrypt.hash(password, 12);
    await user.update({ password: hash, password_reset_code: null, password_reset_expires: null });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
