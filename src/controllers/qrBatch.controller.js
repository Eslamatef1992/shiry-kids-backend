const archiver  = require('archiver');
const qrcode    = require('qrcode');
const Jimp      = require('jimp');
const path      = require('path');
const { QrBatch } = require('../models');

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

async function buildQrImage(serial, vendorLogoPath, shiryLogoPath) {
  const QR_SIZE  = 550;
  const W        = 600;
  const LOGO_H   = 120;
  const SERIAL_H = 60;
  const PAD      = 16;

  const hasVendor = !!vendorLogoPath;
  const hasShiry  = !!shiryLogoPath;
  const hasLogos  = hasVendor || hasShiry;

  const TOTAL_H = QR_SIZE + PAD + (hasLogos ? LOGO_H + PAD : 0) + SERIAL_H + PAD;

  const qrBuf = await qrcode.toBuffer(serial, { width: QR_SIZE, margin: 2 });
  const qrImg = await Jimp.read(qrBuf);

  const canvas = new Jimp(W, TOTAL_H, 0xffffffff);
  canvas.composite(qrImg, Math.floor((W - QR_SIZE) / 2), 0);

  const logoY = QR_SIZE + PAD;

  if (hasVendor && hasShiry) {
    // Both logos side by side
    const LOGO_W = Math.floor((W - PAD * 3) / 2);
    const [vendorImg, shiryImg] = await Promise.all([
      Jimp.read(vendorLogoPath),
      Jimp.read(shiryLogoPath),
    ]);
    vendorImg.contain(LOGO_W, LOGO_H);
    shiryImg.contain(LOGO_W, LOGO_H);
    canvas.composite(vendorImg, PAD, logoY);
    canvas.composite(shiryImg,  PAD * 2 + LOGO_W, logoY);
  } else if (hasVendor) {
    const LOGO_W = 260;
    const vendorImg = await Jimp.read(vendorLogoPath);
    vendorImg.contain(LOGO_W, LOGO_H);
    canvas.composite(vendorImg, Math.floor((W - LOGO_W) / 2), logoY);
  } else if (hasShiry) {
    const LOGO_W = 260;
    const shiryImg = await Jimp.read(shiryLogoPath);
    shiryImg.contain(LOGO_W, LOGO_H);
    canvas.composite(shiryImg, Math.floor((W - LOGO_W) / 2), logoY);
  }

  const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  const displaySerial = serial.replace(/-/g, ' ');
  const tw = Jimp.measureText(font32, displaySerial);
  const serialY = hasLogos ? logoY + LOGO_H + PAD : QR_SIZE + PAD;
  canvas.print(font32, Math.max(0, Math.floor((W - tw) / 2)), serialY, displaySerial);

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

    const vendor_logo = req.files?.vendor_logo?.[0] ? `/uploads/${req.files.vendor_logo[0].filename}` : null;
    const shiry_logo  = req.files?.shiry_logo?.[0]  ? `/uploads/${req.files.shiry_logo[0].filename}`  : null;

    const batch = await QrBatch.create({
      prefix: prefix.trim(),
      quantity: parseInt(quantity, 10),
      vendor_logo,
      shiry_logo,
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
    const shiryLogoPath = batch.shiry_logo
      ? path.join(UPLOADS_DIR, path.basename(batch.shiry_logo))
      : null;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="qr-batch-${batch.prefix}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    for (let i = 0; i < serials.length; i++) {
      const buf  = await buildQrImage(serials[i], vendorLogoPath, shiryLogoPath);
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
