/**
 * Shiry Kids API — Swagger / OpenAPI spec + UI (no extra npm packages needed)
 * Served at /swagger  (UI)  and  /swagger.json  (raw spec)
 */
const express = require('express');
const router  = express.Router();

// ── OpenAPI spec ────────────────────────────────────────────────────────────
const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Shiry Kids API',
    version: '1.0.0',
    description: 'Backend API for the Shiry Kids e-commerce platform (coupons, products, orders, payments).',
  },
  servers: [{ url: '/api/v1', description: 'Production' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // ── Auth ──
    '/auth/register': {
      post: { tags: ['Auth'], summary: 'Register a new user',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, password: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'User created' }, 400: { description: 'Validation error' } },
      },
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Login',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          email: { type: 'string' }, password: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'JWT tokens' }, 401: { description: 'Invalid credentials' } },
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
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Get current user', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'User profile' } },
      },
      put: { tags: ['Auth'], summary: 'Update profile', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, phone: { type: 'string' },
        }}}}},
        responses: { 200: { description: 'Updated profile' } },
      },
      delete: { tags: ['Auth'], summary: 'Delete account', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Account deleted' } },
      },
    },
    '/auth/forgot-password': {
      post: { tags: ['Auth'], summary: 'Send password reset code',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } } },
        responses: { 200: { description: 'Reset code sent' } },
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

    // ── Orders ──
    '/orders': {
      post: { tags: ['Orders'], summary: 'Create order (registered user)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          items: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, type: { type: 'string', enum: ['coupon','product'] }, qty: { type: 'integer' } } } },
          payment_method: { type: 'string', enum: ['knet','visa','cod'] },
          discount_code: { type: 'string' },
          address: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'Order created with coupon_qr_codes' } },
      },
    },
    '/orders/guest': {
      post: { tags: ['Orders'], summary: 'Create guest order',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          items: { type: 'array' }, payment_method: { type: 'string' },
          name: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' },
        }}}}},
        responses: { 201: { description: 'Guest order created' } },
      },
    },
    '/orders/my': {
      get: { tags: ['Orders'], summary: 'Get my orders', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'payment_status', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated orders list' } },
      },
    },
    '/orders/{id}': {
      get: { tags: ['Orders'], summary: 'Get single order (with coupon QR codes)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['order','guest_order'], default: 'order' } },
        ],
        responses: { 200: { description: 'Order with coupon_qr_codes' }, 404: { description: 'Not found' } },
      },
    },

    // ── Admin Orders ──
    '/admin/orders': {
      get: { tags: ['Admin — Orders'], summary: 'List all orders (registered + guest, vendor-enriched)', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'payment_status', in: 'query', schema: { type: 'string' } },
          { name: 'order_status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500 } },
        ],
        responses: { 200: { description: 'All orders with vendor info' } },
      },
    },
    '/admin/orders/guest': {
      get: { tags: ['Admin — Orders'], summary: 'List guest orders only', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Guest orders' } },
      },
    },
    '/admin/orders/{id}': {
      patch: { tags: ['Admin — Orders'], summary: 'Update order status', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          order_status: { type: 'string', enum: ['processing','shipped','arrived','cancelled'] },
          payment_status: { type: 'string', enum: ['pending','paid','failed','refunded'] },
        }}}}},
        responses: { 200: { description: 'Order updated' } },
      },
    },

    // ── Admin Stats ──
    '/admin/stats': {
      get: { tags: ['Admin — Dashboard'], summary: 'Dashboard statistics', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Revenue, orders, customers, vendors, most selling coupon/product, today stats' } },
      },
    },

    // ── Coupons ──
    '/coupons': {
      get: { tags: ['Coupons'], summary: 'List all active coupons (public)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'vendor_id', in: 'query', schema: { type: 'integer' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Coupons list' } },
      },
      post: { tags: ['Admin — Coupons'], summary: 'Create coupon', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          title: { type: 'string' }, price: { type: 'number' }, vendor_id: { type: 'integer' },
          category_id: { type: 'integer' }, description: { type: 'string' }, image: { type: 'string', format: 'binary' },
        }}}}},
        responses: { 201: { description: 'Coupon created' } },
      },
    },
    '/coupons/{id}': {
      get: { tags: ['Coupons'], summary: 'Get coupon by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Coupon detail' } },
      },
      put: { tags: ['Admin — Coupons'], summary: 'Update coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Admin — Coupons'], summary: 'Delete coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Deleted' } },
      },
    },
    '/coupons/{id}/qr-codes': {
      get: { tags: ['Admin — Coupons'], summary: 'List QR codes for a coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'QR codes with status (unassigned/assigned/used)' } },
      },
      post: { tags: ['Admin — Coupons'], summary: 'Upload QR code images for a coupon', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: {
          qr_codes: { type: 'array', items: { type: 'string', format: 'binary' } },
        }}}}},
        responses: { 201: { description: 'QR codes uploaded' } },
      },
    },

    // ── Products ──
    '/products': {
      get: { tags: ['Products'], summary: 'List products (public)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'vendor_id', in: 'query', schema: { type: 'integer' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Products list' } },
      },
    },

    // ── Payments ──
    '/payments/config': {
      get: { tags: ['Payments'], summary: 'Get payment configuration (Tap public key)',
        responses: { 200: { description: 'Payment config' } },
      },
    },
    '/payments/tap/charge': {
      post: { tags: ['Payments'], summary: 'Create Tap charge (KNET / Visa)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          order_id: { type: 'integer' }, order_type: { type: 'string', enum: ['order','guest_order'] },
          method: { type: 'string', enum: ['knet','visa'] },
        }}}}},
        responses: { 200: { description: 'Charge with redirect_url' } },
      },
    },
    '/payments/tap/status': {
      get: { tags: ['Payments'], summary: 'Get payment status for an order',
        parameters: [
          { name: 'order_id', in: 'query', schema: { type: 'integer' } },
          { name: 'order_type', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Payment status' } },
      },
    },

    // ── Vendors ──
    '/vendors': {
      get: { tags: ['Admin — Vendors'], summary: 'List vendors', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Vendors list' } },
      },
      post: { tags: ['Admin — Vendors'], summary: 'Create vendor', security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Vendor created' } },
      },
    },

    // ── Categories ──
    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories (public)',
        responses: { 200: { description: 'Categories' } },
      },
    },

    // ── Discount Coupons ──
    '/discount-coupons/validate/{code}': {
      get: { tags: ['Discount Coupons'], summary: 'Validate a discount coupon code',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Coupon valid' }, 404: { description: 'Invalid or expired' } },
      },
    },

    // ── Health ──
    '/health': {
      get: { tags: ['System'], summary: 'Health check',
        responses: { 200: { description: 'OK' } },
      },
    },
  },
};

// ── Swagger JSON endpoint ────────────────────────────────────────────────────
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(spec);
});

// ── Swagger UI (CDN, no npm package needed) ──────────────────────────────────
router.get('/swagger', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Shiry Kids API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .swagger-ui .topbar { background: #FF383C; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/swagger.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`);
});

module.exports = router;
