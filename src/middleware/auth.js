const jwt = require('jsonwebtoken');
const { Admin, User } = require('../models');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized' });
    req.admin = await Admin.findByPk(decoded.id, { include: ['role'] });
    if (!req.admin || req.admin.status !== 'active') return res.status(401).json({ success: false, message: 'Account inactive' });
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const userAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'user') return res.status(403).json({ success: false, message: 'Not authorized' });
    req.user = await User.findByPk(decoded.id);
    if (!req.user || req.user.status === 'banned') return res.status(401).json({ success: false, message: 'Account inactive' });
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const optionalUserAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id);
    }
  } catch {}
  next();
};

module.exports = { adminAuth, userAuth, optionalUserAuth };
