const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// ── Role ──────────────────────────────────────────────────────────────────────
const Role = sequelize.define('Role', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:        { type: DataTypes.STRING(50), allowNull: false, unique: true },
  permissions: { type: DataTypes.JSON, defaultValue: [] },
});

// ── Admin ─────────────────────────────────────────────────────────────────────
const Admin = sequelize.define('Admin', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:     { type: DataTypes.STRING, allowNull: false },
  email:    { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role_id:  { type: DataTypes.INTEGER, references: { model: 'roles', key: 'id' } },
  status:   { type: DataTypes.ENUM('active','inactive'), defaultValue: 'active' },
  avatar:   { type: DataTypes.STRING, allowNull: true },
});

// ── User ──────────────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:     { type: DataTypes.STRING, allowNull: false },
  email:    { type: DataTypes.STRING, allowNull: false, unique: true },
  phone:    { type: DataTypes.STRING, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: false },
  address:  { type: DataTypes.TEXT, allowNull: true },
  avatar:   { type: DataTypes.STRING, allowNull: true },
  status:   { type: DataTypes.ENUM('active','inactive','banned'), defaultValue: 'active' },
});

// ── Vendor ────────────────────────────────────────────────────────────────────
const Vendor = sequelize.define('Vendor', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:           { type: DataTypes.STRING, allowNull: false },
  name_ar:        { type: DataTypes.STRING, allowNull: true },
  email:          { type: DataTypes.STRING, allowNull: true, unique: true },
  phone:          { type: DataTypes.STRING, allowNull: true },
  logo:           { type: DataTypes.STRING, allowNull: true },
  description:    { type: DataTypes.TEXT, allowNull: true },
  description_ar: { type: DataTypes.TEXT, allowNull: true },
  status:         { type: DataTypes.ENUM('active','inactive','pending'), defaultValue: 'pending' },
});

// ── Category ──────────────────────────────────────────────────────────────────
const Category = sequelize.define('Category', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING, allowNull: false },
  name_ar:   { type: DataTypes.STRING, allowNull: true },
  image:     { type: DataTypes.STRING, allowNull: true },
  parent_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'categories', key: 'id' } },
  sort:      { type: DataTypes.INTEGER, defaultValue: 0 },
});

// ── Product ───────────────────────────────────────────────────────────────────
const Product = sequelize.define('Product', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vendor_id:      { type: DataTypes.INTEGER, references: { model: 'vendors', key: 'id' } },
  category_id:    { type: DataTypes.INTEGER, references: { model: 'categories', key: 'id' } },
  name:           { type: DataTypes.STRING, allowNull: false },
  name_ar:        { type: DataTypes.STRING, allowNull: true },
  description:    { type: DataTypes.TEXT, allowNull: true },
  description_ar: { type: DataTypes.TEXT, allowNull: true },
  price:          { type: DataTypes.DECIMAL(10,3), allowNull: false },
  original_price: { type: DataTypes.DECIMAL(10,3), allowNull: true },
  stock:          { type: DataTypes.INTEGER, defaultValue: 0 },
  images:         { type: DataTypes.JSON, defaultValue: [] },
  sizes:          { type: DataTypes.JSON, defaultValue: [] },
  colors:         { type: DataTypes.JSON, defaultValue: [] },
  tags:           { type: DataTypes.JSON, defaultValue: [] },
  status:         { type: DataTypes.ENUM('active','inactive','draft'), defaultValue: 'active' },
  featured:       { type: DataTypes.BOOLEAN, defaultValue: false },
  is_new_arrival: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_weekly_offer:{ type: DataTypes.BOOLEAN, defaultValue: false },
  rating:         { type: DataTypes.DECIMAL(3,2), defaultValue: 0 },
  reviews_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
});

// ── Product Variant ───────────────────────────────────────────────────────────
const ProductVariant = sequelize.define('ProductVariant', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, references: { model: 'products', key: 'id' } },
  size:       { type: DataTypes.STRING, allowNull: true },
  color:      { type: DataTypes.STRING, allowNull: true },
  sku:        { type: DataTypes.STRING, allowNull: true },
  price:      { type: DataTypes.DECIMAL(10,3), allowNull: true },
  stock:      { type: DataTypes.INTEGER, defaultValue: 0 },
  image:      { type: DataTypes.STRING, allowNull: true },
});

// ── Coupon (brand coupons sold in app) ────────────────────────────────────────
const Coupon = sequelize.define('Coupon', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vendor_id:       { type: DataTypes.INTEGER, references: { model: 'vendors', key: 'id' } },
  title:           { type: DataTypes.STRING, allowNull: false },
  title_ar:        { type: DataTypes.STRING, allowNull: true },
  description:     { type: DataTypes.TEXT, allowNull: true },
  description_ar:  { type: DataTypes.TEXT, allowNull: true },
  image:           { type: DataTypes.STRING, allowNull: true },
  price:           { type: DataTypes.DECIMAL(10,3), allowNull: false },
  original_price:  { type: DataTypes.DECIMAL(10,3), allowNull: true },
  discount_percent:{ type: DataTypes.INTEGER, defaultValue: 0 },
  coupon_count:    { type: DataTypes.INTEGER, defaultValue: 1 },
  expiry_date:     { type: DataTypes.DATE, allowNull: true },
  status:          { type: DataTypes.ENUM('active','inactive','expired'), defaultValue: 'active' },
  featured:        { type: DataTypes.BOOLEAN, defaultValue: false },
});

// ── Discount Coupon (promo codes for checkout) ────────────────────────────────
const DiscountCoupon = sequelize.define('DiscountCoupon', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code:       { type: DataTypes.STRING(50), allowNull: false, unique: true },
  type:       { type: DataTypes.ENUM('percentage','fixed'), allowNull: false },
  value:      { type: DataTypes.DECIMAL(10,3), allowNull: false },
  min_order:  { type: DataTypes.DECIMAL(10,3), defaultValue: 0 },
  max_uses:   { type: DataTypes.INTEGER, defaultValue: null, allowNull: true },
  used_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  expiry_date:{ type: DataTypes.DATE, allowNull: true },
  status:     { type: DataTypes.ENUM('active','inactive','expired'), defaultValue: 'active' },
});

// ── Order ─────────────────────────────────────────────────────────────────────
const Order = sequelize.define('Order', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_number:   { type: DataTypes.STRING, allowNull: false, unique: true },
  user_id:        { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
  items:          { type: DataTypes.JSON, allowNull: false },
  subtotal:       { type: DataTypes.DECIMAL(10,3), allowNull: false },
  discount:       { type: DataTypes.DECIMAL(10,3), defaultValue: 0 },
  shipping_fees:  { type: DataTypes.DECIMAL(10,3), defaultValue: 0 },
  delivery_fees:  { type: DataTypes.DECIMAL(10,3), defaultValue: 1.5 },
  total:          { type: DataTypes.DECIMAL(10,3), allowNull: false },
  payment_method: { type: DataTypes.ENUM('knet','visa','cod'), allowNull: false },
  payment_status: { type: DataTypes.ENUM('paid','pending','failed','refunded'), defaultValue: 'pending' },
  order_status:   { type: DataTypes.ENUM('processing','shipped','arrived','cancelled'), defaultValue: 'processing' },
  qr_code:        { type: DataTypes.STRING, allowNull: true },
  discount_code:  { type: DataTypes.STRING, allowNull: true },
  notes:          { type: DataTypes.TEXT, allowNull: true },
});

// ── Guest Order ───────────────────────────────────────────────────────────────
const GuestOrder = sequelize.define('GuestOrder', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_number:   { type: DataTypes.STRING, allowNull: false, unique: true },
  name:           { type: DataTypes.STRING, allowNull: false },
  phone:          { type: DataTypes.STRING, allowNull: false },
  address:        { type: DataTypes.TEXT, allowNull: false },
  items:          { type: DataTypes.JSON, allowNull: false },
  subtotal:       { type: DataTypes.DECIMAL(10,3), allowNull: false },
  discount:       { type: DataTypes.DECIMAL(10,3), defaultValue: 0 },
  delivery_fees:  { type: DataTypes.DECIMAL(10,3), defaultValue: 1.5 },
  total:          { type: DataTypes.DECIMAL(10,3), allowNull: false },
  payment_method: { type: DataTypes.ENUM('knet','visa','cod'), allowNull: false },
  payment_status: { type: DataTypes.ENUM('paid','pending','failed'), defaultValue: 'pending' },
  order_status:   { type: DataTypes.ENUM('processing','shipped','arrived','cancelled'), defaultValue: 'processing' },
  qr_code:        { type: DataTypes.STRING, allowNull: true },
  discount_code:  { type: DataTypes.STRING, allowNull: true },
});

// ── Coupon QR Code (per-unit QR images uploaded by admin) ─────────────────────
const CouponQrCode = sequelize.define('CouponQrCode', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  coupon_id:   { type: DataTypes.INTEGER, allowNull: false, references: { model: 'coupons', key: 'id' } },
  image:       { type: DataTypes.STRING, allowNull: false },
  status:      { type: DataTypes.ENUM('unassigned','assigned','used'), defaultValue: 'unassigned' },
  order_id:    { type: DataTypes.INTEGER, allowNull: true },
  order_type:  { type: DataTypes.ENUM('order','guest_order'), allowNull: true },
  assigned_at: { type: DataTypes.DATE, allowNull: true },
});

// ── QR Scan Log ───────────────────────────────────────────────────────────────
const QrScanLog = sequelize.define('QrScanLog', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  admin_id:   { type: DataTypes.INTEGER, references: { model: 'admins', key: 'id' } },
  qr_code:    { type: DataTypes.STRING, allowNull: false },
  order_id:   { type: DataTypes.INTEGER, allowNull: true },
  order_type: { type: DataTypes.ENUM('order','guest_order'), allowNull: true },
  status:     { type: DataTypes.ENUM('valid','used','not_found'), allowNull: false },
});

// ── Banner ────────────────────────────────────────────────────────────────────
const Banner = sequelize.define('Banner', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:    { type: DataTypes.STRING, allowNull: true },
  title_ar: { type: DataTypes.STRING, allowNull: true },
  image:    { type: DataTypes.STRING, allowNull: false },
  link:     { type: DataTypes.STRING, allowNull: true },
  sort:     { type: DataTypes.INTEGER, defaultValue: 0 },
  status:   { type: DataTypes.ENUM('active','inactive'), defaultValue: 'active' },
});

// ── Ad ────────────────────────────────────────────────────────────────────────
const Ad = sequelize.define('Ad', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:          { type: DataTypes.STRING, allowNull: true },
  title_ar:       { type: DataTypes.STRING, allowNull: true },
  image:          { type: DataTypes.STRING, allowNull: false },
  link_type:      { type: DataTypes.ENUM('none','product','coupon','external'), defaultValue: 'none' },
  product_id:     { type: DataTypes.INTEGER, allowNull: true, references: { model: 'products', key: 'id' } },
  coupon_id:      { type: DataTypes.INTEGER, allowNull: true, references: { model: 'coupons', key: 'id' } },
  external_link:  { type: DataTypes.STRING, allowNull: true },
  sort:           { type: DataTypes.INTEGER, defaultValue: 0 },
  status:         { type: DataTypes.ENUM('active','inactive'), defaultValue: 'active' },
});

// ── Setting ───────────────────────────────────────────────────────────────────
const Setting = sequelize.define('Setting', {
  id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key:   { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT, allowNull: true },
  group: { type: DataTypes.STRING, defaultValue: 'general' },
  label: { type: DataTypes.STRING, allowNull: true },
  type:  { type: DataTypes.ENUM('text','number','boolean','json','image'), defaultValue: 'text' },
});

// ── SEO Page ──────────────────────────────────────────────────────────────────
const SeoPage = sequelize.define('SeoPage', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  page:        { type: DataTypes.STRING, allowNull: false, unique: true },
  title:       { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  keywords:    { type: DataTypes.TEXT, allowNull: true },
  og_image:    { type: DataTypes.STRING, allowNull: true },
});

// ── CMS Page ──────────────────────────────────────────────────────────────────
const CmsPage = sequelize.define('CmsPage', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug:       { type: DataTypes.STRING, allowNull: false, unique: true },
  title:      { type: DataTypes.STRING, allowNull: false },
  title_ar:   { type: DataTypes.STRING, allowNull: true },
  content:    { type: DataTypes.TEXT('long'), allowNull: true },
  content_ar: { type: DataTypes.TEXT('long'), allowNull: true },
  status:     { type: DataTypes.ENUM('published','draft'), defaultValue: 'published' },
  sort:       { type: DataTypes.INTEGER, defaultValue: 0 },
});

// ── Device Token (for push notifications) ─────────────────────────────────────
const DeviceToken = sequelize.define('DeviceToken', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:  { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  token:    { type: DataTypes.STRING(512), allowNull: false, unique: true },
  platform: { type: DataTypes.ENUM('ios','android','web'), allowNull: true },
});

// ── Push Notification (sent by admin) ──────────────────────────────────────────
const PushNotification = sequelize.define('PushNotification', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:       { type: DataTypes.STRING, allowNull: false },
  title_ar:    { type: DataTypes.STRING, allowNull: true },
  body:        { type: DataTypes.TEXT, allowNull: false },
  body_ar:     { type: DataTypes.TEXT, allowNull: true },
  image:       { type: DataTypes.STRING, allowNull: true },
  link_type:   { type: DataTypes.ENUM('none','product','coupon','external'), defaultValue: 'none' },
  link_target: { type: DataTypes.STRING, allowNull: true },
  recipients:  { type: DataTypes.INTEGER, defaultValue: 0 },
  sent_count:  { type: DataTypes.INTEGER, defaultValue: 0 },
  admin_id:    { type: DataTypes.INTEGER, allowNull: true, references: { model: 'admins', key: 'id' } },
});

// ── Associations ──────────────────────────────────────────────────────────────
Admin.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(Admin, { foreignKey: 'role_id' });

Product.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Vendor.hasMany(Product, { foreignKey: 'vendor_id' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id' });

Coupon.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
Vendor.hasMany(Coupon, { foreignKey: 'vendor_id' });

Coupon.hasMany(CouponQrCode, { foreignKey: 'coupon_id', as: 'qr_codes', onDelete: 'CASCADE' });
CouponQrCode.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

Order.hasMany(CouponQrCode, { foreignKey: 'order_id', constraints: false, scope: { order_type: 'order' }, as: 'coupon_qr_codes' });
GuestOrder.hasMany(CouponQrCode, { foreignKey: 'order_id', constraints: false, scope: { order_type: 'guest_order' }, as: 'coupon_qr_codes' });

Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Order, { foreignKey: 'user_id' });

QrScanLog.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

Ad.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Ad.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

DeviceToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
PushNotification.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

module.exports = {
  sequelize,
  Role, Admin, User, Vendor, Category,
  Product, ProductVariant, Coupon, DiscountCoupon, CouponQrCode,
  Order, GuestOrder, QrScanLog,
  Setting, SeoPage, CmsPage, Banner, Ad,
  DeviceToken, PushNotification,
};
