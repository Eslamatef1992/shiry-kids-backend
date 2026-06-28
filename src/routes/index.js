const router = require('express').Router();
const { adminAuth, userAuth, optionalUserAuth, requirePermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadExcel = require('../middleware/uploadExcel');

const auth     = require('../controllers/auth.controller');
const admin    = require('../controllers/admin.controller');
const product  = require('../controllers/product.controller');
const coupon   = require('../controllers/coupon.controller');
const order    = require('../controllers/order.controller');
const qr       = require('../controllers/qr.controller');
const dc       = require('../controllers/discountCoupon.controller');
const settings = require('../controllers/setting.controller');
const seo      = require('../controllers/seo.controller');
const cms      = require('../controllers/cms.controller');
const category = require('../controllers/category.controller');
const banner   = require('../controllers/banner.controller');
const ad       = require('../controllers/ad.controller');
const notification = require('../controllers/notification.controller');
const landing  = require('../controllers/landing.controller');
const payment  = require('../controllers/payment.controller');
const qrGenerator = require('../controllers/qrGenerator.controller');

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/auth/admin/login',    auth.adminLogin);
router.post('/auth/register',       auth.register);
router.post('/auth/login',          auth.login);
router.post('/auth/refresh',        auth.refresh);
router.post('/auth/forgot-password',   auth.forgotPassword);
router.post('/auth/verify-reset-code', auth.verifyResetCode);
router.post('/auth/send-otp',          auth.sendOtp);
router.post('/auth/verify-otp',        auth.verifyOtp);
router.post('/auth/reset-password',    auth.resetPassword);
router.get ('/settings/public',     settings.public);
router.get ('/cms/:slug',           cms.get);
router.get ('/discount-coupons/validate/:code', dc.validate);
router.get ('/categories',          category.list);
router.get ('/categories/:id',      category.get);
router.get ('/banners',             banner.list);
router.get ('/ads',                 ad.list);
router.get ('/landing',             landing.getAll);

// Push notification device token registration (works for guests too)
router.post('/notifications/register-token', optionalUserAuth, notification.registerToken);

// ── Tap Payments ────────────────────────────────────────────────────────────
router.get ('/payments/config',      payment.config);
router.post('/payments/tap/charge',  payment.createTapCharge);
router.get ('/payments/tap/return',  payment.tapReturn);
router.post('/payments/tap/webhook', payment.tapWebhook);
router.get ('/payments/tap/status',  payment.tapStatus);

// ── User authenticated ────────────────────────────────────────────────────────
router.get ('/auth/me',             userAuth, auth.me);
router.put ('/auth/me',             userAuth, auth.updateMe);
router.delete('/auth/me',           userAuth, auth.terminateAccount);
router.post('/auth/me/avatar',      userAuth, upload.single('avatar'), auth.updateAvatar);
router.post('/orders',              userAuth, order.createOrder);
router.post('/orders/guest',        order.createGuestOrder);
router.get ('/orders/my',           userAuth, order.myOrders);
router.get ('/orders/:id',          optionalUserAuth, order.getOrder);

// ── Admin authenticated ───────────────────────────────────────────────────────
router.get ('/auth/admin/me',       adminAuth, auth.adminMe);
router.get ('/admin/stats',         adminAuth, admin.stats);

// Roles & Admins — super admin only (role permissions include '*')
const superAdminOnly = requirePermission();

// Roles
router.get   ('/roles',             adminAuth, superAdminOnly, admin.listRoles);
router.post  ('/roles',             adminAuth, superAdminOnly, admin.createRole);
router.put   ('/roles/:id',         adminAuth, superAdminOnly, admin.updateRole);
router.delete('/roles/:id',         adminAuth, superAdminOnly, admin.removeRole);

// Admins
router.get   ('/admins',            adminAuth, superAdminOnly, admin.listAdmins);
router.post  ('/admins',            adminAuth, superAdminOnly, admin.createAdmin);
router.put   ('/admins/:id',        adminAuth, superAdminOnly, admin.updateAdmin);
router.delete('/admins/:id',        adminAuth, superAdminOnly, admin.removeAdmin);

// Users
const canManageUsers = requirePermission('manage_users');
router.get('/users',                adminAuth, canManageUsers, admin.listUsers);
router.put('/users/:id',            adminAuth, canManageUsers, admin.updateUser);

// Vendors — used by both the products and coupons catalogs
const canManageVendors = requirePermission('manage_products', 'manage_coupons');
router.get   ('/vendors',           adminAuth, canManageVendors, admin.listVendors);
router.post  ('/vendors',           adminAuth, canManageVendors, upload.single('logo'), admin.createVendor);
router.put   ('/vendors/:id',       adminAuth, canManageVendors, upload.single('logo'), admin.updateVendor);
router.delete('/vendors/:id',       adminAuth, canManageVendors, admin.removeVendor);

// Products (also public list for Flutter)
const canManageProducts = requirePermission('manage_products');
router.get   ('/products',          product.list);
router.get   ('/products/:id',      product.get);
router.post  ('/products',          adminAuth, canManageProducts, upload.array('images', 10), product.create);
router.put   ('/products/:id',      adminAuth, canManageProducts, upload.array('images', 10), product.update);
router.delete('/products/:id',      adminAuth, canManageProducts, product.remove);

// Coupons (also public for Flutter)
const canManageCoupons = requirePermission('manage_coupons');
router.get   ('/coupons',           coupon.list);
router.get   ('/coupons/:id',       coupon.get);
router.post  ('/coupons',           adminAuth, canManageCoupons, upload.single('image'), coupon.create);
router.put   ('/coupons/:id',       adminAuth, canManageCoupons, upload.single('image'), coupon.update);
router.delete('/coupons/:id',       adminAuth, canManageCoupons, coupon.remove);

// Coupon QR codes (admin) — bulk-upload per-unit QR images
router.get   ('/coupons/:id/qr-codes',       adminAuth, canManageCoupons, coupon.listQrCodes);
router.post  ('/coupons/:id/qr-codes',       adminAuth, canManageCoupons, upload.array('qr_codes', 200), coupon.uploadQrCodes);
router.delete('/coupons/:id/qr-codes/:qrId', adminAuth, canManageCoupons, coupon.removeQrCode);

// Orders (admin)
const canManageOrders = requirePermission('manage_orders');
router.get('/admin/orders',         adminAuth, canManageOrders, order.adminListOrders);
router.get('/admin/orders/guest',   adminAuth, canManageOrders, order.adminListGuestOrders);
router.patch('/admin/orders/:id',   adminAuth, canManageOrders, order.updateOrderStatus);

// QR
const canScanQr = requirePermission('scan_qr');
router.post('/qr/scan',             adminAuth, canScanQr, qr.scan);
router.get ('/qr/history',          adminAuth, canScanQr, qr.history);

// QR Code Generator (bulk-generate QR images from an uploaded Excel/CSV)
router.post('/qr-codes/generate',   adminAuth, canScanQr, uploadExcel.single('file'), qrGenerator.generate);

// Discount coupons (admin CRUD)
router.get   ('/discount-coupons',  adminAuth, canManageCoupons, dc.list);
router.post  ('/discount-coupons',  adminAuth, canManageCoupons, dc.create);
router.put   ('/discount-coupons/:id', adminAuth, canManageCoupons, dc.update);
router.delete('/discount-coupons/:id', adminAuth, canManageCoupons, dc.remove);

// Settings / SEO / CMS / Banners / Ads / Notifications / Landing page
const canManageSettings = requirePermission('manage_settings');

// Settings
router.get('/settings',             adminAuth, canManageSettings, settings.list);
router.post('/settings',            adminAuth, canManageSettings, settings.update);

// SEO
router.get ('/seo',                 adminAuth, canManageSettings, seo.list);
router.post('/seo',                 adminAuth, canManageSettings, seo.upsert);

// CMS
router.get   ('/cms',               adminAuth, canManageSettings, cms.list);
router.post  ('/cms',               adminAuth, canManageSettings, cms.create);
router.put   ('/cms/:id',           adminAuth, canManageSettings, cms.update);
router.delete('/cms/:id',           adminAuth, canManageSettings, cms.remove);

// Categories (admin CRUD) — part of the products catalog
router.post  ('/categories',        adminAuth, canManageProducts, upload.single('image'), category.create);
router.put   ('/categories/:id',    adminAuth, canManageProducts, upload.single('image'), category.update);
router.delete('/categories/:id',    adminAuth, canManageProducts, category.remove);

// Banners (admin CRUD)
router.post  ('/banners',           adminAuth, canManageSettings, upload.single('image'), banner.create);
router.put   ('/banners/:id',       adminAuth, canManageSettings, upload.single('image'), banner.update);
router.delete('/banners/:id',       adminAuth, canManageSettings, banner.remove);

// Ads (admin CRUD)
router.get   ('/ads/:id',           adminAuth, canManageSettings, ad.get);
router.post  ('/ads',               adminAuth, canManageSettings, upload.single('image'), ad.create);
router.put   ('/ads/:id',           adminAuth, canManageSettings, upload.single('image'), ad.update);
router.delete('/ads/:id',           adminAuth, canManageSettings, ad.remove);

// Push notifications (admin)
router.get ('/notifications',       adminAuth, canManageSettings, notification.list);
router.post('/notifications/send',  adminAuth, canManageSettings, upload.single('image'), notification.send);

// Landing page (admin)
router.get   ('/landing/sections',       adminAuth, canManageSettings, landing.listSections);
router.put   ('/landing/sections/:key',  adminAuth, canManageSettings, landing.upsertSection);
router.get   ('/landing/items',          adminAuth, canManageSettings, landing.listItems);
router.post  ('/landing/items',          adminAuth, canManageSettings, upload.single('image'), landing.createItem);
router.put   ('/landing/items/:id',      adminAuth, canManageSettings, upload.single('image'), landing.updateItem);
router.delete('/landing/items/:id',      adminAuth, canManageSettings, landing.removeItem);
router.post  ('/landing/upload',         adminAuth, canManageSettings, upload.single('file'), landing.uploadImage);

module.exports = router;
