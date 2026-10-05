const bcrypt    = require('bcryptjs');
const { Admin, Role, Coupon, CouponQrCode, QrScanLog, QrRedemption, Order, GuestOrder, User, Vendor } = require('../models');
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

// ── GET /vendor/scan-logs ─────────────────────────────────────────────────────
// QrScanLog entries (every scan attempt) for this vendor's scanners.
exports.scanLogs = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const vendorId = req.admin.vendor_id;

    const scannerIds = await Admin.findAll({
      where: { vendor_id: vendorId }, attributes: ['id'],
    }).then(rows => rows.map(r => r.id));

    if (!scannerIds.length) return res.json({ success: true, data: [] });

    const logs = await QrScanLog.findAll({
      where: { admin_id: { [Op.in]: scannerIds } },
      include: [{ model: Admin, as: 'admin', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 300,
    });

    res.json({
      success: true,
      data: logs.map(l => ({
        id:         l.id,
        qrCode:     l.qr_code,
        status:     l.status,
        scannerName:l.admin?.name || '—',
        scannedAt:  l.createdAt,
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

// ── PUT /vendor/scanners/:id/password ────────────────────────────────────────
exports.resetScannerPassword = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const scanner = await Admin.findOne({ where: { id: req.params.id, vendor_id: req.admin.vendor_id } });
    if (!scanner) return res.status(404).json({ success: false, message: 'Scanner not found' });
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    await scanner.update({ password: await bcrypt.hash(password, 12) });
    res.json({ success: true, message: 'Password updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── PUT /vendor/scanners/:id/status ──────────────────────────────────────────
exports.toggleScannerStatus = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const scanner = await Admin.findOne({ where: { id: req.params.id, vendor_id: req.admin.vendor_id } });
    if (!scanner) return res.status(404).json({ success: false, message: 'Scanner not found' });
    const newStatus = scanner.status === 'active' ? 'inactive' : 'active';
    await scanner.update({ status: newStatus });
    res.json({ success: true, status: newStatus });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── GET /vendor/scanner-stats ─────────────────────────────────────────────────
// Per-scanner breakdown: scans and redemptions count
exports.scannerStats = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const vendorId = req.admin.vendor_id;

    const scanners = await Admin.findAll({
      where: { vendor_id: vendorId },
      attributes: ['id', 'name'],
    });
    const scannerIds = scanners.map(s => s.id);
    if (!scannerIds.length) return res.json({ success: true, data: [] });

    const { fn, col, literal } = require('sequelize');

    const scanCounts = await QrScanLog.findAll({
      where: { admin_id: { [Op.in]: scannerIds } },
      attributes: ['admin_id', [fn('COUNT', col('id')), 'total'], [fn('SUM', literal("CASE WHEN status='valid' THEN 1 ELSE 0 END")), 'scanned'], [fn('SUM', literal("CASE WHEN status='used' THEN 1 ELSE 0 END")), 'redeemed']],
      group: ['admin_id'],
      raw: true,
    });

    const countMap = {};
    scanCounts.forEach(r => { countMap[r.admin_id] = r; });

    res.json({
      success: true,
      data: scanners.map(s => ({
        id:       s.id,
        name:     s.name,
        total:    parseInt(countMap[s.id]?.total    || 0, 10),
        scanned:  parseInt(countMap[s.id]?.scanned  || 0, 10),
        redeemed: parseInt(countMap[s.id]?.redeemed || 0, 10),
      })),
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── GET /vendor/daily-activity ────────────────────────────────────────────────
// Last 30 days daily scan counts for the vendor
exports.dailyActivity = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const vendorId = req.admin.vendor_id;

    const scannerIds = await Admin.findAll({
      where: { vendor_id: vendorId }, attributes: ['id'],
    }).then(rows => rows.map(r => r.id));

    if (!scannerIds.length) return res.json({ success: true, data: [] });

    const { fn, col, literal } = require('sequelize');
    const since = new Date();
    since.setDate(since.getDate() - 29);

    const rows = await QrScanLog.findAll({
      where: {
        admin_id: { [Op.in]: scannerIds },
        created_at: { [Op.gte]: since },
      },
      attributes: [
        [fn('DATE', col('created_at')), 'day'],
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN status='valid' THEN 1 ELSE 0 END")), 'scanned'],
        [fn('SUM', literal("CASE WHEN status='used' THEN 1 ELSE 0 END")), 'redeemed'],
      ],
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    });

    res.json({ success: true, data: rows });
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

// ── GET /vendor/redemptions ───────────────────────────────────────────────────
// Returns all scanned redemptions for this vendor, with client details.
exports.redemptions = async (req, res) => {
  try {
    if (!requireVendor(req, res)) return;
    const vendorId = req.admin.vendor_id;

    const scannerIds = await Admin.findAll({
      where: { vendor_id: vendorId },
      attributes: ['id'],
    }).then(rows => rows.map(r => r.id));

    if (!scannerIds.length) return res.json({ success: true, data: [] });

    const redemptions = await QrRedemption.findAll({
      where: { admin_id: { [Op.in]: scannerIds } },
      include: [{ model: Admin, as: 'admin', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 200,
    });

    // Enrich with client name from order
    const enriched = await Promise.all(redemptions.map(async (r) => {
      const row = r.toJSON();
      let clientName = '—';
      let clientPhone = '—';
      let purchasedAt = row.createdAt;

      try {
        if (row.order_id && row.order_type === 'order') {
          const order = await Order.findByPk(row.order_id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'phone'] }],
          });
          if (order) {
            clientName  = order.user?.name  || '—';
            clientPhone = order.user?.phone || '—';
            purchasedAt = order.createdAt;
          }
        } else if (row.order_id && row.order_type === 'guest_order') {
          const go = await GuestOrder.findByPk(row.order_id, { attributes: ['name', 'phone', 'created_at'] });
          if (go) {
            clientName  = go.name  || '—';
            clientPhone = go.phone || '—';
            purchasedAt = go.createdAt;
          }
        }
      } catch (_) {}

      return {
        id:             row.id,
        qrCode:         row.qr_code,
        couponName:     row.coupon_name,
        purchaseAmount: row.purchase_amount,
        scannerName:    row.admin?.name || '—',
        clientName,
        clientPhone,
        purchasedAt,
        scannedAt:      row.createdAt,
      };
    }));

    res.json({ success: true, data: enriched });
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
