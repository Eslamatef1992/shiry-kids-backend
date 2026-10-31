const { sequelize, Coupon, Vendor } = require('../models');
const { QueryTypes } = require('sequelize');

exports.salesReport = async (req, res) => {
  try {
    const { from, to, coupon_id, search, order_type } = req.query;

    let conditions = `q.status IN ('assigned', 'used')`;
    const params = {};

    if (from)       { conditions += ` AND DATE(q.assigned_at) >= :from`;        params.from = from; }
    if (to)         { conditions += ` AND DATE(q.assigned_at) <= :to`;          params.to = to; }
    if (coupon_id)  { conditions += ` AND q.coupon_id = :coupon_id`;            params.coupon_id = coupon_id; }
    if (order_type && order_type !== 'all') {
                      conditions += ` AND q.order_type = :order_type`;          params.order_type = order_type; }

    const rows = await sequelize.query(`
      SELECT
        q.id,
        q.assigned_at,
        q.status,
        q.order_type,
        q.order_id,
        c.id        AS coupon_id,
        c.title     AS coupon_title,
        c.price     AS coupon_price,
        v.id        AS vendor_id,
        v.name      AS vendor_name,
        COALESCE(u.name,  go.name)  AS customer_name,
        COALESCE(u.phone, go.phone) AS customer_phone,
        COALESCE(o.order_number, go.order_number) AS order_number
      FROM coupon_qr_codes q
      JOIN coupons c ON c.id = q.coupon_id
      LEFT JOIN vendors     v  ON v.id  = c.vendor_id
      LEFT JOIN orders      o  ON o.id  = q.order_id AND q.order_type = 'order'
      LEFT JOIN users       u  ON u.id  = o.user_id
      LEFT JOIN guest_orders go ON go.id = q.order_id AND q.order_type = 'guest_order'
      WHERE ${conditions}
      ORDER BY q.assigned_at DESC
    `, { replacements: params, type: QueryTypes.SELECT });

    // Optional text search (customer name / phone / order number)
    let data = rows;
    if (search) {
      const q = search.trim().toLowerCase();
      data = rows.filter(r =>
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_phone?.toLowerCase().includes(q) ||
        r.order_number?.toLowerCase().includes(q)
      );
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalSold      = data.length;
    const totalRevenue   = data.reduce((s, r) => s + parseFloat(r.coupon_price || 0), 0);
    const uniqueCustomers = new Set(data.map(r => r.customer_phone).filter(Boolean)).size;
    const uniqueOrders   = new Set(data.map(r => r.order_number).filter(Boolean)).size;

    // ── By Coupon ─────────────────────────────────────────────────────────────
    const couponMap = {};
    data.forEach(r => {
      const key = r.coupon_id;
      if (!couponMap[key]) couponMap[key] = { coupon_id: key, title: r.coupon_title, price: parseFloat(r.coupon_price || 0), count: 0, revenue: 0 };
      couponMap[key].count++;
      couponMap[key].revenue += parseFloat(r.coupon_price || 0);
    });
    const byCoupon = Object.values(couponMap).sort((a, b) => b.count - a.count)
      .map(c => ({ ...c, revenue: +c.revenue.toFixed(3) }));

    // ── By Date ───────────────────────────────────────────────────────────────
    const dateMap = {};
    data.forEach(r => {
      const date = r.assigned_at ? new Date(r.assigned_at).toISOString().slice(0, 10) : 'unknown';
      if (!dateMap[date]) dateMap[date] = { date, count: 0, revenue: 0 };
      dateMap[date].count++;
      dateMap[date].revenue += parseFloat(r.coupon_price || 0);
    });
    const byDate = Object.values(dateMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(d => ({ ...d, revenue: +d.revenue.toFixed(3) }));

    // ── By Customer ───────────────────────────────────────────────────────────
    const customerMap = {};
    data.forEach(r => {
      const key = r.customer_phone || 'unknown';
      if (!customerMap[key]) customerMap[key] = { customer_name: r.customer_name, customer_phone: r.customer_phone, count: 0, revenue: 0 };
      customerMap[key].count++;
      customerMap[key].revenue += parseFloat(r.coupon_price || 0);
    });
    const byCustomer = Object.values(customerMap)
      .sort((a, b) => b.count - a.count)
      .map(c => ({ ...c, revenue: +c.revenue.toFixed(3) }));

    // ── By Vendor ─────────────────────────────────────────────────────────────
    const vendorMap = {};
    data.forEach(r => {
      const key = r.vendor_id || 'unknown';
      if (!vendorMap[key]) vendorMap[key] = { vendor_id: key, vendor_name: r.vendor_name || 'Unknown', count: 0, revenue: 0 };
      vendorMap[key].count++;
      vendorMap[key].revenue += parseFloat(r.coupon_price || 0);
    });
    const byVendor = Object.values(vendorMap)
      .sort((a, b) => b.count - a.count)
      .map(v => ({ ...v, revenue: +v.revenue.toFixed(3) }));

    res.json({
      success: true,
      summary: {
        total_sold:        totalSold,
        total_revenue:     +totalRevenue.toFixed(3),
        unique_customers:  uniqueCustomers,
        unique_orders:     uniqueOrders,
      },
      by_coupon:   byCoupon,
      by_date:     byDate,
      by_customer: byCustomer,
      by_vendor:   byVendor,
      rows:        data,
    });
  } catch (e) {
    console.error('Report error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── GET /admin/reports/ui-coupons ─────────────────────────────────────────────
// All coupons as cards with sold/scanned counts
exports.uiCoupons = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        c.id, c.title, c.image, c.price,
        v.name AS vendor_name,
        COUNT(DISTINCT q.id) AS total_sold,
        COUNT(DISTINCT sl.id) AS total_scanned
      FROM coupons c
      LEFT JOIN vendors v ON v.id = c.vendor_id
      LEFT JOIN coupon_qr_codes q ON q.coupon_id = c.id AND q.order_id IS NOT NULL
      LEFT JOIN qr_scan_logs sl ON sl.qr_code = q.code AND sl.status = 'valid'
      GROUP BY c.id, c.title, c.image, c.price, v.name
      ORDER BY total_sold DESC
    `, { type: QueryTypes.SELECT });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── GET /admin/reports/ui-coupons/:id ────────────────────────────────────────
// All purchases for a specific coupon with scan info + filters
exports.uiCouponDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, filter } = req.query; // filter: sold | scanned | sold_scanned

    let conditions = `q.coupon_id = :id AND q.order_id IS NOT NULL`;
    const params = { id };
    if (from) { conditions += ` AND DATE(q.assigned_at) >= :from`; params.from = from; }
    if (to)   { conditions += ` AND DATE(q.assigned_at) <= :to`;   params.to   = to; }

    const rows = await sequelize.query(`
      SELECT
        q.id, q.code, q.status AS qr_status, q.assigned_at,
        q.order_id, q.order_type,
        c.title AS coupon_title, c.price AS coupon_price,
        COALESCE(u.name,  go.name)        AS customer_name,
        COALESCE(u.phone, go.phone)       AS customer_phone,
        COALESCE(o.order_number, go.order_number) AS order_number,
        sl.created_at AS scanned_at,
        a.name AS scanned_by
      FROM coupon_qr_codes q
      JOIN coupons c ON c.id = q.coupon_id
      LEFT JOIN orders       o  ON o.id  = q.order_id AND q.order_type = 'order'
      LEFT JOIN users        u  ON u.id  = o.user_id
      LEFT JOIN guest_orders go ON go.id = q.order_id AND q.order_type = 'guest_order'
      LEFT JOIN qr_scan_logs sl ON sl.qr_code = q.code AND sl.status = 'valid'
      LEFT JOIN admins       a  ON a.id = sl.admin_id
      WHERE ${conditions}
      ORDER BY q.assigned_at DESC
    `, { replacements: params, type: QueryTypes.SELECT });

    // Apply filter
    let data = rows;
    if (filter === 'scanned')      data = rows.filter(r => r.scanned_at);
    if (filter === 'sold_scanned') data = rows.filter(r => r.scanned_at);
    if (filter === 'sold')         data = rows.filter(r => !r.scanned_at);

    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
