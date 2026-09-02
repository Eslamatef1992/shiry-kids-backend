const archiver = require('archiver');
const qrcode   = require('qrcode');
const Jimp     = require('jimp');
const path     = require('path');
const { QrBatch } = require('../models');

const LOGO_PATH = path.join(__dirname, '../assets/shiry-logo.png');

// ── helpers ───────────────────────────────────────────────────────────────────

// Parse a prefix like "ICE-C1" → base "ICE-C" + startNum 1
function parsePrefix(raw) {
  const s = raw.trim();
  const m = s.match(/^(.*?)(\d+)$/);
  if (m) return { base: m[1], startNum: parseInt(m[2], 10) };
  return { base: s, startNum: 1 };
}

// Build serial list: prefix="ICE-C1", qty=3 → ["ICE-C1","ICE-C2","ICE-C3"]
function buildSerials(prefix, quantity) {
  const { base, startNum } = parsePrefix(prefix);
  return Array.from({ length: quantity }, (_, i) => `${base}${startNum + i}`);
}

// Generate a single branded PNG buffer for a serial code
async function buildQrImage(serial) {
  const QR_SIZE   = 550;
  const W         = 600;
  const LOGO_W    = 260;   // logo scaled width
  const LOGO_H    = Math.round(LOGO_W * (1756 / 2748)); // preserve aspect ~166px
  const SERIAL_H  = 60;
  const PAD       = 16;
  const TOTAL_H   = QR_SIZE + PAD + LOGO_H + PAD + SERIAL_H + PAD;

  // QR code PNG
  const qrBuf = await qrcode.toBuffer(serial, { width: QR_SIZE, margin: 2 });
  const qrImg = await Jimp.read(qrBuf);

  // Logo
  const logoImg = await Jimp.read(LOGO_PATH);
  logoImg.resize(LOGO_W, LOGO_H);

  // White canvas
  const canvas = new Jimp(W, TOTAL_H, 0xffffffff);

  // Composite QR centred at top
  canvas.composite(qrImg, Math.floor((W - QR_SIZE) / 2), 0);

  // Composite logo centred below QR
  const logoY = QR_SIZE + PAD;
  canvas.composite(logoImg, Math.floor((W - LOGO_W) / 2), logoY);

  // Serial text centred below logo
  const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  // Jimp bitmap fonts don't render hyphens — replace with space for display
  const displaySerial = serial.replace(/-/g, ' ');
  const tw = Jimp.measureText(font32, displaySerial);
  canvas.print(font32, Math.max(0, Math.floor((W - tw) / 2)), logoY + LOGO_H + PAD, displaySerial);

  return canvas.getBufferAsync(Jimp.MIME_PNG);
}

// ── controllers ───────────────────────────────────────────────────────────────

exports.list = async (req, res) => {
  try {
    const rows = await QrBatch.findAll({ order: [['created_at', 'DESC']] });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { prefix, quantity } = req.body;
    if (!prefix || !quantity || quantity < 1 || quantity > 500)
      return res.status(400).json({ success: false, message: 'prefix and quantity (1–500) required' });

    const batch = await QrBatch.create({ prefix: prefix.trim(), quantity: parseInt(quantity, 10) });
    res.status(201).json({ success: true, data: batch });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.download = async (req, res) => {
  try {
    const batch = await QrBatch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const serials = buildSerials(batch.prefix, batch.quantity);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="qr-batch-${batch.prefix}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    for (let i = 0; i < serials.length; i++) {
      const serial = serials[i];
      const buf    = await buildQrImage(serial);
      const safe   = serial.replace(/[^a-zA-Z0-9_-]/g, '_');
      archive.append(buf, { name: `${String(i + 1).padStart(3, '0')}_${safe}.png` });
    }

    await archive.finalize();
  } catch (e) {
    console.error('QR batch download error:', e.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const batch = await QrBatch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Not found' });
    await batch.destroy();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
