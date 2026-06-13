// Tap Payments (https://api.tap.company) helper utilities.
//
// Keys live in the Setting table (group: 'payment') so they can be managed
// from the admin dashboard's "Payment" tab — `tap_mode` switches between the
// test and live key pairs. Secret keys are NEVER returned by
// /settings/public (see setting.controller.js).
const { Setting } = require('../models');

const TAP_API_BASE = 'https://api.tap.company/v2';

async function settingsMap(keys) {
  const rows = await Setting.findAll({ where: { key: keys } });
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// Resolves the active Tap mode + key pair from the Setting table.
async function getTapConfig() {
  const keys = [
    'tap_mode',
    'tap_test_secret_key', 'tap_test_publishable_key',
    'tap_live_secret_key', 'tap_live_publishable_key',
  ];
  const s = await settingsMap(keys);
  const mode = (s.tap_mode || 'test').toLowerCase() === 'live' ? 'live' : 'test';
  const secretKey = mode === 'live' ? s.tap_live_secret_key : s.tap_test_secret_key;
  const publishableKey = mode === 'live' ? s.tap_live_publishable_key : s.tap_test_publishable_key;
  return { mode, secretKey: secretKey || '', publishableKey: publishableKey || '' };
}

async function tapRequest(method, path, secretKey, body) {
  const res = await fetch(`${TAP_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON response */ }
  return { ok: res.ok, status: res.status, data };
}

// Creates a Tap charge. `payload` follows Tap's Charges API body shape, e.g.
// { amount, currency, source: { id }, customer, redirect, post, metadata }.
function createCharge(secretKey, payload) {
  return tapRequest('POST', '/charges', secretKey, payload);
}

// Retrieves a charge by id to confirm its final status.
function retrieveCharge(secretKey, chargeId) {
  return tapRequest('GET', `/charges/${chargeId}`, secretKey);
}

module.exports = { getTapConfig, createCharge, retrieveCharge };
