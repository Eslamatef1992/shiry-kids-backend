const router = require('express').Router();
const { adminAuth, userAuth, optionalUserAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

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

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/auth/admin/login',    auth.adminLogin);
router.post('/auth/register',       auth.register);
router.post('/auth/login',          auth.login);
router.post('/auth/refresh',        auth.refresh);
router.post('/auth/forgot-password',   auth.forgotPassword);
router.post('/auth/verify-reset-code', auth.verifyResetCode);
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

// ── Admin authenticated ───────────────────────────────────────────────────────
router.get ('/auth/admin/me',       adminAuth, auth.adminMe);
router.get ('/admin/stats',         adminAuth, admin.stats);

// Roles
router.get   ('/roles',             adminAuth, admin.listRoles);
router.post  ('/roles',             adminAuth, admin.createRole);
router.put   ('/roles/:id',         adminAuth, admin.updateRole);
router.delete('/roles/:id',         adminAuth, admin.removeRole);

// Admins
router.get   ('/admins',            adminAuth, admin.listAdmins);
router.post  ('/admins',            adminAuth, admin.createAdmin);
router.put   ('/admins/:id',        adminAuth, admin.updateAdmin);
router.delete('/admins/:id',        adminAuth, admin.removeAdmin);

// Users
router.get('/users',                adminAuth, admin.listUsers);
router.put('/users/:id',            adminAuth, admin.updateUser);

// Vendors
router.get   ('/vendors',           adminAuth, admin.listVendors);
router.post  ('/vendors',           adminAuth, upload.single('logo'), admin.createVendor);
router.put   ('/vendors/:id',       adminAuth, upload.single('logo'), admin.updateVendor);
router.delete('/vendors/:id',       adminAuth, admin.removeVendor);

// Products (also public list for Flutter)
router.get   ('/products',          product.list);
router.get   ('/products/:id',      product.get);
router.post  ('/products',          adminAuth, upload.array('images', 10), product.create);
router.put   ('/products/:id',      adminAuth, upload.array('images', 10), product.update);
router.delete('/products/:id',      adminAuth, product.remove);

// Coupons (also public for Flutter)
router.get   ('/coupons',           coupon.list);
router.get   ('/coupons/:id',       coupon.get);
router.post  ('/coupons',           adminAuth, upload.single('image'), coupon.create);
router.put   ('/coupons/:id',       adminAuth, upload.single('image'), coupon.update);
router.delete('/coupons/:id',       adminAuth, coupon.remove);

// Coupon QR codes (admin) — bulk-upload per-unit QR images
router.get   ('/coupons/:id/qr-codes',       adminAuth, coupon.listQrCodes);
router.post  ('/coupons/:id/qr-codes',       adminAuth, upload.array('qr_codes', 200), coupon.uploadQrCodes);
router.delete('/coupons/:id/qr-codes/:qrId', adminAuth, coupon.removeQrCode);

// Orders (admin)
router.get('/admin/orders',         adminAuth, order.adminListOrders);
router.get('/admin/orders/guest',   adminAuth, order.adminListGuestOrders);
router.patch('/admin/orders/:id',   adminAuth, order.updateOrderStatus);

// QR
router.post('/qr/scan',             adminAuth, qr.scan);
router.get ('/qr/history',          adminAuth, qr.history);

// Discount coupons (admin CRUD)
router.get   ('/discount-coupons',  adminAuth, dc.list);
router.post  ('/discount-coupons',  adminAuth, dc.create);
router.put   ('/discount-coupons/:id', adminAuth, dc.update);
router.delete('/discount-coupons/:id', adminAuth, dc.remove);

// Settings
router.get('/settings',             adminAuth, settings.list);
router.post('/settings',            adminAuth, settings.update);

// SEO
router.get ('/seo',                 adminAuth, seo.list);
router.post('/seo',                 adminAuth, seo.upsert);

// CMS
router.get   ('/cms',               adminAuth, cms.list);
router.post  ('/cms',               adminAuth, cms.create);
router.put   ('/cms/:id',           adminAuth, cms.update);
router.delete('/cms/:id',           adminAuth, cms.remove);

// Categories (admin CRUD)
router.post  ('/categories',        adminAuth, upload.single('image'), category.create);
router.put   ('/categories/:id',    adminAuth, upload.single('image'), category.update);
router.delete('/categories/:id',    adminAuth, category.remove);

// Banners (admin CRUD)
router.post  ('/banners',           adminAuth, upload.single('image'), banner.create);
router.put   ('/banners/:id',       adminAuth, upload.single('image'), banner.update);
router.delete('/banners/:id',       adminAuth, banner.remove);

// Ads (admin CRUD)
router.get   ('/ads/:id',           adminAuth, ad.get);
router.post  ('/ads',               adminAuth, upload.single('image'), ad.create);
router.put   ('/ads/:id',           adminAuth, upload.single('image'), ad.update);
router.delete('/ads/:id',           adminAuth, ad.remove);

// Push notifications (admin)
router.get ('/notifications',       adminAuth, notification.list);
router.post('/notifications/send',  adminAuth, upload.single('image'), notification.send);

// Landing page (admin)
router.get   ('/landing/sections',       adminAuth, landing.listSections);
router.put   ('/landing/sections/:key',  adminAuth, landing.upsertSection);
router.get   ('/landing/items',          adminAuth, landing.listItems);
router.post  ('/landing/items',          adminAuth, upload.single('image'), landing.createItem);
router.put   ('/landing/items/:id',      adminAuth, upload.single('image'), landing.updateItem);
router.delete('/landing/items/:id',      adminAuth, landing.removeItem);
router.post  ('/landing/upload',         adminAuth, upload.single('file'), landing.uploadImage);

module.exports = router;
