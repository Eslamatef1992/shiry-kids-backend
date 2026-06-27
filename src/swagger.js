/**
 * Shiry Kids API — Swagger / OpenAPI spec + UI (no extra npm packages needed)
 * Served at /swagger  (UI)  and  /swagger.json  (raw spec)
 */
const express = require('express');
const router  = express.Router();

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Shiry Kids API',
    version: '1.0.0',
    description: 'Backend API for the Shiry Kids e-commerce platform.',
  },
  servers: [{ url: '/api/v1', description: 'Production' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  tags: [
    { name: 'Auth' },
    { name: 'Orders' },
    { name: 'Coupons' },
    { name: 'Products' },
    { name: 'Categories' },
    { name: 'Payments' },
    { name: 'Discount Coupons' },
    { name: 'Notifications' },
    { name: 'Landing Page' },
    { name: 'Banners & Ads' },
    { name: 'QR' },
    { name: 'Admin — Dashboard' },
    { name: 'Admin — Roles & Admins' },
    { name: 'Admin — Users' },
    { name: 'Admin — Vendors' },
    { name: 'Admin — Settings / SEO / CMS' },
  ],
  paths: {

    // ────────────────────────────────────────────────
    // AUTH
    // ────────────────────────────────────────────────
    '/auth/register': {
      post: { tags: ['Auth'], summary: 'Register new user',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name','email','password'], properties: {
          name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, password: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'User created + tokens' }, 400: { description: 'Validation error' } },
      },
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Login',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email','password'], properties: {
          email: { type: 'string' }, password: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'JWT access + refresh tokens' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/admin/login': {
      post: { tags: ['Auth'], summary: 'Admin login',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          email: { type: 'string' }, password: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'Admin JWT' } },
      },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Refresh access token',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          refresh_token: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'New access token' } },
      },
    },
    '/auth/forgot-password': {
      post: { tags: ['Auth'], summary: 'Send password reset code to email',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } } },
        responses: { 200: { description: 'Reset code sent' } },
      },
    },
    '/auth/verify-reset-code': {
      post: { tags: ['Auth'], summary: 'Verify password reset code',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          email: { type: 'string' }, code: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'Code verified' } },
      },
    },
    '/auth/reset-password': {
      post: { tags: ['Auth'], summary: 'Reset password',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          email: { type: 'string' }, code: { type: 'string' }, password: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'Password updated' } },
      },
    },
    '/auth/me': {
      get:    { tags: ['Auth'], summary: 'Get current user profile', security: [{ bearerAuth: [] }], responses: { 200: { description: 'User object' } } },
      put:    { tags: ['Auth'], summary: 'Update profile', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'Updated user' } },
      },
      delete: { tags: ['Auth'], summary: 'Delete account', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Account deleted' } } },
    },
    '/auth/me/avatar': {
      post: { tags: ['Auth'], summary: 'Upload avatar', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } } } } },
        responses: { 200: { description: 'Avatar updated' } },
      },
    },
    '/auth/admin/me': {
      get: { tags: ['Auth'], summary: 'Get current admin profile', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Admin object with role/permissions' } } },
    },

    // ────────────────────────────────────────────────
    // ORDERS
    // ────────────────────────────────────────────────
    '/orders': {
      post: { tags: ['Orders'], summary: 'Create order (registered user)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          items: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, type: { type: 'string', enum: ['coupon','product'] }, qty: { type: 'integer' } } } },
          payment_method: { type: 'string', enum: ['knet','visa','cod'] },
          delivery_method: { type: 'string', enum: ['pickup','address'] },
          discount_code: { type: 'string' },
          address: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'Order created — includes coupon_qr_codes assigned from stock' } },
      },
    },
    '/orders/guest': {
      post: { tags: ['Orders'], summary: 'Create guest order (no login required)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          items: { type: 'array' },
          payment_method: { type: 'string', enum: ['knet','visa','cod'] },
          name: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' },
          discount_code: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'Guest order created' } },
      },
    },
    '/orders/my': {
      get: { tags: ['Orders'], summary: 'Get logged-in user\'s orders', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'payment_status', in: 'query', schema: { type: 'string', enum: ['pending','paid','failed','refunded'] } },
        ],
        responses: { 200: { description: 'Paginated orders with coupon_qr_codes' } },
      },
    },
    '/orders/{id}': {
      get: { tags: ['Orders'], summary: 'Get a single order (with assigned QR codes)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['order','guest_order'], default: 'order' } },
        ],
        responses: { 200: { description: 'Order + coupon_qr_codes' }, 404: { description: 'Not found' } },
      },
    },
    '/admin/orders': {
      get: { tags: ['Orders'], summary: 'Admin — list all orders (registered + guest, vendor-enriched)', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'payment_status', in: 'query', schema: { type: 'string' } },
          { name: 'order_status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500 } },
        ],
        responses: { 200: { description: 'All orders sorted by date desc, items enriched with vendor_name' } },
      },
    },
    '/admin/orders/guest': {
      get: { tags: ['Orders'], summary: 'Admin — list guest orders only', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Guest orders' } },
      },
    },
    '/admin/orders/{id}': {
      patch: { tags: ['Orders'], summary: 'Admin — update order status', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          order_status: { type: 'string', enum: ['processing','shipped','arrived','cancelled'] },
          payment_status: { type: 'string', enum: ['pending','paid','failed','refunded'] },
        }}}}},
        responses: { 200: { description: 'Order updated' } },
      },
    },

    // ────────────────────────────────────────────────
    // COUPONS
    // ────────────────────────────────────────────────
    '/coupons': {
      get: { tags: ['Coupons'], summary: 'List active coupons (public)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'vendor_id', in: 'query', schema: { type: 'integer' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Coupons list' } },
      },
      post: { tags: ['Coupons'], summary: 'Admin — create coupon', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          title: { type: 'string' }, title_ar: { type: 'string' }, price: { type: 'number' },
          vendor_id: { type: 'integer' }, category_id: { type: 'integer' },
          description: { type: 'string' }, description_ar: { type: 'string' },
          status: { type: 'string', enum: ['active','inactive','expired'] },
          coupon_count: { type: 'integer' },
          image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Coupon created' } },
      },
    },
    '/coupons/{id}': {
      get:    { tags: ['Coupons'], summary: 'Get coupon by ID (public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Coupon detail' } },
      },
      put:    { tags: ['Coupons'], summary: 'Admin — update coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Coupons'], summary: 'Admin — delete coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/coupons/{id}/qr-codes': {
      get: { tags: ['Coupons'], summary: 'Admin — list QR codes for a coupon (with status)', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'QR codes: unassigned / assigned / used' } },
      },
      post: { tags: ['Coupons'], summary: 'Admin — upload QR code images for a coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          qr_codes: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Up to 200 images' },
        }}}}},
        responses: { 201: { description: 'QR codes uploaded and queued as unassigned' } },
      },
    },
    '/coupons/{id}/qr-codes/{qrId}': {
      delete: { tags: ['Coupons'], summary: 'Admin — delete a single QR code', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'qrId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // PRODUCTS
    // ────────────────────────────────────────────────
    '/products': {
      get: { tags: ['Products'], summary: 'List products (public)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'vendor_id', in: 'query', schema: { type: 'integer' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Products list' } },
      },
      post: { tags: ['Products'], summary: 'Admin — create product', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          name: { type: 'string' }, name_ar: { type: 'string' }, price: { type: 'number' },
          vendor_id: { type: 'integer' }, category_id: { type: 'integer' },
          description: { type: 'string' }, description_ar: { type: 'string' },
          images: { type: 'array', items: { type: 'string', format: 'binary' } },
        }}}}},
        responses: { 201: { description: 'Product created' } },
      },
    },
    '/products/{id}': {
      get:    { tags: ['Products'], summary: 'Get product by ID (public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Product detail' } },
      },
      put:    { tags: ['Products'], summary: 'Admin — update product', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Products'], summary: 'Admin — delete product', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // CATEGORIES
    // ────────────────────────────────────────────────
    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories (public)', responses: { 200: { description: 'Categories' } } },
      post: { tags: ['Categories'], summary: 'Admin — create category', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          name: { type: 'string' }, name_ar: { type: 'string' }, image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/categories/{id}': {
      get:    { tags: ['Categories'], summary: 'Get category (public)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Category' } },
      },
      put:    { tags: ['Categories'], summary: 'Admin — update category', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Categories'], summary: 'Admin — delete category', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // PAYMENTS
    // ────────────────────────────────────────────────
    '/payments/config': {
      get: { tags: ['Payments'], summary: 'Get Tap payment config (public key)', responses: { 200: { description: 'Tap config' } } },
    },
    '/payments/tap/charge': {
      post: { tags: ['Payments'], summary: 'Create Tap KNET/Visa charge',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          order_id: { type: 'integer' }, order_type: { type: 'string', enum: ['order','guest_order'] },
          method: { type: 'string', enum: ['knet','visa'] },
        }}}}},
        responses: { 200: { description: 'Charge with redirect_url for bank auth' } },
      },
    },
    '/payments/tap/return': {
      get: { tags: ['Payments'], summary: 'Tap redirect return URL (called by bank after payment)',
        responses: { 200: { description: 'Payment confirmed, order updated' } },
      },
    },
    '/payments/tap/webhook': {
      post: { tags: ['Payments'], summary: 'Tap webhook (called by Tap servers)',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/payments/tap/status': {
      get: { tags: ['Payments'], summary: 'Check payment status for an order',
        parameters: [
          { name: 'order_id', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'order_type', in: 'query', schema: { type: 'string', enum: ['order','guest_order'], default: 'order' } },
        ],
        responses: { 200: { description: 'Payment status' } },
      },
    },

    // ────────────────────────────────────────────────
    // DISCOUNT COUPONS
    // ────────────────────────────────────────────────
    '/discount-coupons/validate/{code}': {
      get: { tags: ['Discount Coupons'], summary: 'Validate a discount coupon code (public)',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Coupon valid + discount info' }, 404: { description: 'Invalid or expired' } },
      },
    },
    '/discount-coupons': {
      get:  { tags: ['Discount Coupons'], summary: 'Admin — list discount coupons', security: [{ bearerAuth: [] }], responses: { 200: { description: 'List' } } },
      post: { tags: ['Discount Coupons'], summary: 'Admin — create discount coupon', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          code: { type: 'string' }, type: { type: 'string', enum: ['percentage','fixed'] },
          value: { type: 'number' }, min_order: { type: 'number' }, status: { type: 'string', enum: ['active','inactive'] },
        }}}}},
        responses: { 201: { description: 'Created' } },
      },
    },
    '/discount-coupons/{id}': {
      put:    { tags: ['Discount Coupons'], summary: 'Admin — update discount coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Discount Coupons'], summary: 'Admin — delete discount coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // QR SCANNER
    // ────────────────────────────────────────────────
    '/qr/scan': {
      post: { tags: ['QR'], summary: 'Admin — scan a coupon QR code to mark as used', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          qr_data: { type: 'string', description: 'The decoded text from the QR code' },
        }}}}},
        responses: { 200: { description: 'QR marked as used' }, 404: { description: 'QR not found' } },
      },
    },
    '/qr/history': {
      get: { tags: ['QR'], summary: 'Admin — scan history log', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of scan events' } },
      },
    },
    '/qr-codes/generate': {
      post: { tags: ['QR'], summary: 'Admin — bulk-generate QR images from Excel/CSV upload', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          file: { type: 'string', format: 'binary', description: 'Excel or CSV with codes in first column' },
        }}}}},
        responses: { 200: { description: 'ZIP of generated QR images' } },
      },
    },

    // ────────────────────────────────────────────────
    // NOTIFICATIONS
    // ────────────────────────────────────────────────
    '/notifications/register-token': {
      post: { tags: ['Notifications'], summary: 'Register FCM device token',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          token: { type: 'string' }, platform: { type: 'string', enum: ['ios','android'] },
        }}}}},
        responses: { 200: { description: 'Token registered' } },
      },
    },
    '/notifications': {
      get: { tags: ['Notifications'], summary: 'Admin — list sent notifications', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notifications list' } },
      },
    },
    '/notifications/send': {
      post: { tags: ['Notifications'], summary: 'Admin — send push notification to all users', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          title: { type: 'string' }, body: { type: 'string' }, image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 200: { description: 'Notification sent' } },
      },
    },

    // ────────────────────────────────────────────────
    // BANNERS & ADS
    // ────────────────────────────────────────────────
    '/banners': {
      get:  { tags: ['Banners & Ads'], summary: 'List banners (public)', responses: { 200: { description: 'Banners' } } },
      post: { tags: ['Banners & Ads'], summary: 'Admin — create banner', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          title: { type: 'string' }, link: { type: 'string' }, image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Created' } },
      },
    },
    '/banners/{id}': {
      put:    { tags: ['Banners & Ads'], summary: 'Admin — update banner', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Banners & Ads'], summary: 'Admin — delete banner', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/ads': {
      get:  { tags: ['Banners & Ads'], summary: 'List ads (public)', responses: { 200: { description: 'Ads' } } },
      post: { tags: ['Banners & Ads'], summary: 'Admin — create ad', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          title: { type: 'string' }, link: { type: 'string' }, image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Created' } },
      },
    },
    '/ads/{id}': {
      get:    { tags: ['Banners & Ads'], summary: 'Admin — get single ad', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Ad' } },
      },
      put:    { tags: ['Banners & Ads'], summary: 'Admin — update ad', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Banners & Ads'], summary: 'Admin — delete ad', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // LANDING PAGE
    // ────────────────────────────────────────────────
    '/landing': {
      get: { tags: ['Landing Page'], summary: 'Get full landing page data (public)', responses: { 200: { description: 'Sections + items' } } },
    },
    '/landing/sections': {
      get: { tags: ['Landing Page'], summary: 'Admin — list landing sections', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Sections' } } },
    },
    '/landing/sections/{key}': {
      put: { tags: ['Landing Page'], summary: 'Admin — upsert landing section', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Upserted' } },
      },
    },
    '/landing/items': {
      get:  { tags: ['Landing Page'], summary: 'Admin — list landing items', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Items' } } },
      post: { tags: ['Landing Page'], summary: 'Admin — create landing item', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          title: { type: 'string' }, link: { type: 'string' }, image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Created' } },
      },
    },
    '/landing/items/{id}': {
      put:    { tags: ['Landing Page'], summary: 'Admin — update landing item', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Landing Page'], summary: 'Admin — delete landing item', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/landing/upload': {
      post: { tags: ['Landing Page'], summary: 'Admin — upload an image for landing page', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          file: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 200: { description: 'Uploaded URL' } },
      },
    },

    // ────────────────────────────────────────────────
    // ADMIN — DASHBOARD
    // ────────────────────────────────────────────────
    '/admin/stats': {
      get: { tags: ['Admin — Dashboard'], summary: 'Dashboard statistics', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Revenue, orders, customers, vendors, most selling coupon/product, today stats, pending orders' } },
      },
    },

    // ────────────────────────────────────────────────
    // ADMIN — ROLES & ADMINS
    // ────────────────────────────────────────────────
    '/roles': {
      get:  { tags: ['Admin — Roles & Admins'], summary: 'List roles', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Roles' } } },
      post: { tags: ['Admin — Roles & Admins'], summary: 'Create role', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, permissions: { type: 'array', items: { type: 'string' } },
        }}}}},
        responses: { 201: { description: 'Role created' } },
      },
    },
    '/roles/{id}': {
      put:    { tags: ['Admin — Roles & Admins'], summary: 'Update role', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Admin — Roles & Admins'], summary: 'Delete role', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/admins': {
      get:  { tags: ['Admin — Roles & Admins'], summary: 'List admins', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Admins' } } },
      post: { tags: ['Admin — Roles & Admins'], summary: 'Create admin', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, role_id: { type: 'integer' },
        }}}}},
        responses: { 201: { description: 'Admin created' } },
      },
    },
    '/admins/{id}': {
      put:    { tags: ['Admin — Roles & Admins'], summary: 'Update admin', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Admin — Roles & Admins'], summary: 'Delete admin', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // ADMIN — USERS
    // ────────────────────────────────────────────────
    '/users': {
      get: { tags: ['Admin — Users'], summary: 'List registered users', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Users list' } },
      },
    },
    '/users/{id}': {
      put: { tags: ['Admin — Users'], summary: 'Update user', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
    },

    // ────────────────────────────────────────────────
    // ADMIN — VENDORS
    // ────────────────────────────────────────────────
    '/vendors': {
      get:  { tags: ['Admin — Vendors'], summary: 'List vendors', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Vendors' } } },
      post: { tags: ['Admin — Vendors'], summary: 'Create vendor', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          name: { type: 'string' }, name_ar: { type: 'string' }, logo: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Created' } },
      },
    },
    '/vendors/{id}': {
      put:    { tags: ['Admin — Vendors'], summary: 'Update vendor', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Admin — Vendors'], summary: 'Delete vendor', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // ADMIN — SETTINGS / SEO / CMS
    // ────────────────────────────────────────────────
    '/settings/public': {
      get: { tags: ['Admin — Settings / SEO / CMS'], summary: 'Get public settings (app name, logo, etc.)', responses: { 200: { description: 'Public settings' } } },
    },
    '/settings': {
      get:  { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — list all settings', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Settings' } } },
      post: { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — update settings', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/seo': {
      get:  { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — list SEO entries', security: [{ bearerAuth: [] }], responses: { 200: { description: 'SEO list' } } },
      post: { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — upsert SEO entry', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          page: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, keywords: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'Upserted' } },
      },
    },
    '/cms': {
      get:  { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — list CMS pages', security: [{ bearerAuth: [] }], responses: { 200: { description: 'CMS pages' } } },
      post: { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — create CMS page', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          slug: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'Created' } },
      },
    },
    '/cms/{slug}': {
      get: { tags: ['Admin — Settings / SEO / CMS'], summary: 'Get CMS page by slug (public)',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'CMS page content' } },
      },
    },
    '/cms/{id}': {
      put:    { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — update CMS page', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Admin — Settings / SEO / CMS'], summary: 'Admin — delete CMS page', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },

    // ────────────────────────────────────────────────
    // SYSTEM
    // ────────────────────────────────────────────────
    '/health': {
      get: { tags: ['System'], summary: 'Health check', responses: { 200: { description: '{ status: "ok" }' } } },
    },
  },
};

router.get('/swagger.json', (req, res) => res.json(spec));

router.get('/swagger', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><title>Shiry Kids API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0}.swagger-ui .topbar{background:#FF383C}.swagger-ui .topbar .download-url-wrapper{display:none}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url:'/swagger.json', dom_id:'#swagger-ui',
      presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout:'BaseLayout', deepLinking:true, tryItOutEnabled:true });
  </script>
</body>
</html>`);
});

module.exports = router;
