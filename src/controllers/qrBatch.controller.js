const archiver  = require('archiver');
const qrcode    = require('qrcode');
const Jimp      = require('jimp');
const path      = require('path');
const { QrBatch } = require('../models');

const SHIRY_LOGO = path.join(__dirname, '../assets/shiry-logo.png');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// ── helpers ───────────────────────────────────────────────────────────────────

function parsePrefix(raw) {
  const s = raw.trim();
  const m = s.match(/^(.*?)(\d+)$/);
  if (m) return { base: m[1], startNum: parseInt(m[2], 10) };
  return { base: s, startNum: 1 };
}

function buildSerials(prefix, quantity) {
  const { base, startNum } = parsePrefix(prefix);
  return Array.from({ length: quantity }, (_, i) => `${base}${startNum + i}`);
}

async function buildQrImage(serial, vendorLogoPath) {
  const QR_SIZE  = 550;
  const W        = 600;
  const LOGO_H   = 120;   // height for each logo row
  const SERIAL_H = 60;
  const PAD      = 16;
  const TOTAL_H  = QR_SIZE + PAD + LOGO_H + PAD + SERIAL_H + PAD;

  // QR code
  const qrBuf = await qrcode.toBuffer(serial, { width: QR_SIZE, margin: 2 });
  const qrImg = await Jimp.read(qrBuf);

  // White canvas
  const canvas = new Jimp(W, TOTAL_H, 0xffffffff);
  canvas.composite(qrImg, Math.floor((W - QR_SIZE) / 2), 0);

  const logoY = QR_SIZE + PAD;

  if (vendorLogoPath) {
    // Two logos side by side: vendor (left) | shiry (right)
    const LOGO_W = Math.floor((W - PAD * 3) / 2); // equal width with gap

    const [vendorImg, shiryImg] = await Promise.all([
      Jimp.read(vendorLogoPath),
      Jimp.read(SHIRY_LOGO),
    ]);

    vendorImg.contain(LOGO_W, LOGO_H);
    shiryImg.contain(LOGO_W, LOGO_H);

    const vendorX = PAD;
    const shiryX  = PAD * 2 + LOGO_W;

    canvas.composite(vendorImg, vendorX, logoY);
    canvas.composite(shiryImg,  shiryX,  logoY);
  } else {
    // Only Shiry logo centred
    const LOGO_W = 260;
    const shiryImg = await Jimp.read(SHIRY_LOGO);
    shiryImg.contain(LOGO_W, LOGO_H);
    canvas.composite(shiryImg, Math.floor((W - LOGO_W) / 2), logoY);
  }

  // Serial text
  const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
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

    const vendor_logo = req.file ? `/uploads/${req.file.filename}` : null;

    const batch = await QrBatch.create({
      prefix: prefix.trim(),
      quantity: parseInt(quantity, 10),
      vendor_logo,
    });
    res.status(201).json({ success: true, data: batch });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.download = async (req, res) => {
  try {
    const batch = await QrBatch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const serials = buildSerials(batch.prefix, batch.quantity);
    const vendorLogoPath = batch.vendor_logo
      ? path.join(UPLOADS_DIR, path.basename(batch.vendor_logo))
      : null;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="qr-batch-${batch.prefix}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    for (let i = 0; i < serials.length; i++) {
      const buf  = await buildQrImage(serials[i], vendorLogoPath);
      const safe = serials[i].replace(/[^a-zA-Z0-9_-]/g, '_');
      archive.append(buf, { name: `${String(i + 1).padStart(3, '0')}_${safe}.png` });
    }

    await archive.finalize();
  } catch (e) {
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
