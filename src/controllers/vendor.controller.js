const bcrypt    = require('bcryptjs');
const { Admin, Role, Coupon, CouponQrCode, QrScanLog, Vendor } = require('../models');
const { Op }    = require('sequelize');

// Helper: ensure the calling admin has a vendor assigned
const requireVendor = (req, res) => {
  if (!req.admin.vendor_id) {
    res.status(403).json({ success: false, message: 'No vendor assigned to your account' });
    return false;
  }
  return true;
};

// ── GET /vendor/stats ─────────────────────────────────────────────────────────
// Returns coupon stats for the scanner's assigned vendor.
exports.stats = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const vendorId = req.admin.vendor_id;

    // Total coupons created for this vendor
    const totalCoupons = await Coupon.count({ where: { vendor_id: vendorId } });

    // Total coupon QR units sold (assigned or used — means a user purchased)
    const totalSold = await CouponQrCode.count({
      where: { status: { [Op.in]: ['assigned', 'used'] } },
      include: [{ model: Coupon, as: 'coupon', where: { vendor_id: vendorId }, attributes: [] }],
    });

    // Total scanned by admins linked to this vendor
    const scannerIds = await Admin.findAll({
      where: { vendor_id: vendorId },
      attributes: ['id'],
    }).then(rows => rows.map(r => r.id));

    const totalScanned = scannerIds.length
      ? await QrScanLog.count({ where: { admin_id: { [Op.in]: scannerIds }, status: 'valid' } })
      : 0;

    // Coupon breakdown
    const coupons = await Coupon.findAll({
      where: { vendor_id: vendorId },
      attributes: ['id', 'title', 'title_ar', 'price', 'status', 'coupon_count', 'image'],
      order: [['created_at', 'DESC']],
    });

    // Per-coupon sold + scanned counts
    const couponIds = coupons.map(c => c.id);
    const soldPerCoupon = couponIds.length
      ? await CouponQrCode.findAll({
          where: { coupon_id: { [Op.in]: couponIds }, status: { [Op.in]: ['assigned', 'used'] } },
          attributes: ['coupon_id', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
          group: ['coupon_id'],
          raw: true,
        })
      : [];

    const soldMap = {};
    soldPerCoupon.forEach(r => { soldMap[r.coupon_id] = parseInt(r.count, 10); });

    res.json({
      success: true,
      vendor: req.admin.vendor,
      summary: { totalCoupons, totalSold, totalScanned },
      coupons: coupons.map(c => ({
        ...c.toJSON(),
        sold: soldMap[c.id] || 0,
      })),
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── GET /vendor/scanners ──────────────────────────────────────────────────────
// Lists all scanner sub-accounts for the calling admin's vendor.
exports.listScanners = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const scanners = await Admin.findAll({
      where: { vendor_id: req.admin.vendor_id },
      include: [{ model: Role, as: 'role' }],
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data: scanners });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── POST /vendor/scanners ─────────────────────────────────────────────────────
// Creates a scanner sub-account linked to the same vendor.
exports.createScanner = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'name, email, and password are required' });

    // Find the scanner role (has scan_qr permission)
    const scannerRole = await Role.findOne({
      where: require('sequelize').where(
        require('sequelize').cast(require('sequelize').col('permissions'), 'char'),
        { [Op.like]: '%scan_qr%' }
      ),
    });

    const hash    = await bcrypt.hash(password, 12);
    const scanner = await Admin.create({
      name,
      email,
      password:  hash,
      role_id:   scannerRole?.id || null,
      vendor_id: req.admin.vendor_id,
    });

    const full = await Admin.findByPk(scanner.id, {
      include: [{ model: Role, as: 'role' }, { model: Vendor, as: 'vendor', attributes: ['id','name','name_ar'] }],
      attributes: { exclude: ['password'] },
    });
    res.status(201).json({ success: true, data: full });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── DELETE /vendor/scanners/:id ───────────────────────────────────────────────
exports.removeScanner = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const scanner = await Admin.findOne({ where: { id: req.params.id, vendor_id: req.admin.vendor_id } });
    if (!scanner) return res.status(404).json({ success: false, message: 'Scanner not found' });
    await scanner.destroy();
    res.json({ success: true, message: 'Scanner removed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
