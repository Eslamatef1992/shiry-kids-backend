const { Coupon, Vendor, CouponQrCode, Order, GuestOrder, User } = require('../models');
const { paginate, paginateResponse, decodeQrFromImage } = require('../utils/helpers');
const { Op } = require('sequelize');

const TRUE_VALUES = ['true', '1', 1, true];
const buildCouponData = (body) => {
  const data = { ...body };
  if (data.featured !== undefined) data.featured = TRUE_VALUES.includes(data.featured);
  return data;
};

// Attach `qr_total` / `qr_available` to a coupon's JSON so clients can tell
// whether the coupon is sold out (only meaningful for coupons that use the
// per-unit QR system — coupons with no uploaded QR codes are treated as
// unlimited, matching resolveOrderItems's stock-check logic).
const withQrStock = async (coupon) => {
  const json = coupon.toJSON();
  const qr_total = await CouponQrCode.count({ where: { coupon_id: coupon.id } });
  const qr_available = qr_total > 0
    ? await CouponQrCode.count({ where: { coupon_id: coupon.id, status: 'unassigned' } })
    : 0;
  return { ...json, qr_total, qr_available };
};

exports.list = async (req, res) => {
  try {
    const { page=1, limit=20, search, vendor_id, status, featured, category } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { title_ar: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { description_ar: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { '$vendor.name$': { [Op.like]: `%${search}%` } },
        { '$vendor.name_ar$': { [Op.like]: `%${search}%` } },
      ];
    }
    if (vendor_id) where.vendor_id = vendor_id;
    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured === 'true';
    if (category) where.category = category;
    const { count, rows } = await Coupon.findAndCountAll({
      where, include: ['vendor'], ...paginate(page, limit), order: [['created_at','DESC']],
      distinct: true, subQuery: false,
    });
    const data = await Promise.all(rows.map(withQrStock));
    res.json({ success: true, data, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const c = await Coupon.findByPk(req.params.id, { include: ['vendor'] });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await withQrStock(c) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const data = buildCouponData(req.body);
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    const coupon = await Coupon.create(data);
    res.status(201).json({ success: true, data: coupon });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const data = buildCouponData(req.body);
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    await coupon.update(data);
    res.json({ success: true, data: coupon });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    await coupon.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Coupon QR Codes (per-unit images, assigned to orders FIFO) ────────────────

exports.listQrCodes = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const items = await CouponQrCode.findAll({ where: { coupon_id: req.params.id }, order: [['id', 'ASC']] });

    // Enrich assigned/used QR codes with customer name + phone
    const assignedItems = items.filter(i => i.status !== 'unassigned' && i.order_id);
    const orderIds     = [...new Set(assignedItems.filter(i => i.order_type === 'order').map(i => i.order_id))];
    const guestIds     = [...new Set(assignedItems.filter(i => i.order_type === 'guest_order').map(i => i.order_id))];

    const [orders, guestOrders] = await Promise.all([
      orderIds.length  ? Order.findAll({ where: { id: orderIds }, include: [{ model: User, as: 'user', attributes: ['name','phone'] }], attributes: ['id','order_number'] }) : [],
      guestIds.length  ? GuestOrder.findAll({ where: { id: guestIds }, attributes: ['id','order_number','name','phone'] }) : [],
    ]);

    const orderMap = Object.fromEntries(orders.map(o => [o.id, { name: o.user?.name, phone: o.user?.phone, order_number: o.order_number }]));
    const guestMap = Object.fromEntries(guestOrders.map(o => [o.id, { name: o.name, phone: o.phone, order_number: o.order_number }]));

    const enriched = items.map(i => {
      const plain = i.toJSON();
      if (i.status !== 'unassigned' && i.order_id) {
        const info = i.order_type === 'guest_order' ? guestMap[i.order_id] : orderMap[i.order_id];
        plain.customer_name   = info?.name   || null;
        plain.customer_phone  = info?.phone  || null;
        plain.order_number    = info?.order_number || null;
      }
      return plain;
    });

    const summary = {
      total:      items.length,
      unassigned: items.filter(i => i.status === 'unassigned').length,
      assigned:   items.filter(i => i.status === 'assigned').length,
      used:       items.filter(i => i.status === 'used').length,
    };
    res.json({ success: true, data: enriched, summary });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.uploadQrCodes = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ success: false, message: 'No files uploaded' });

    // The number of QR codes uploaded for a coupon cannot exceed its quantity
    // (coupon_count) — each unit sold gets exactly one unique QR code.
    const existingCount = await CouponQrCode.count({ where: { coupon_id: coupon.id } });
    const maxAllowed = coupon.coupon_count || 0;
    if (existingCount + files.length > maxAllowed) {
      const remaining = Math.max(maxAllowed - existingCount, 0);
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Only ${remaining} more QR code(s) can be uploaded for this coupon (quantity: ${maxAllowed}, already uploaded: ${existingCount}).`
          : `QR code limit reached for this coupon (quantity: ${maxAllowed}).`,
      });
    }

    const created = await Promise.all(
      files.map(async (f) => {
        const filePath = `/uploads/${f.filename}`;
        // Decode the QR code embedded in the uploaded image so a customer's
        // physical scan of the printed code can later be matched back to
        // this record by the super admin scanner.
        const code = await decodeQrFromImage(f.path);
        return CouponQrCode.create({ coupon_id: coupon.id, image: filePath, code });
      })
    );
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeQrCode = async (req, res) => {
  try {
    const item = await CouponQrCode.findOne({ where: { id: req.params.qrId, coupon_id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    if (item.status !== 'unassigned') {
      return res.status(400).json({ success: false, message: 'Cannot delete an assigned/used QR code' });
    }
    await item.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
