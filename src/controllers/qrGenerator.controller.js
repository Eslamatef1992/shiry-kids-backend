const XLSX = require('xlsx');
const archiver = require('archiver');
const qrcode = require('qrcode');
const Jimp = require('jimp');

// Matches a usable QR value: either a full URL or a code-like token
// (letters/numbers/hyphens/underscores, no spaces). Anything else
// (e.g. a title/header row like "TEST - Sheri Kids Format (1)") is skipped.
const isUsableValue = (val) => {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^[A-Za-z0-9_-]{3,}$/.test(s);
};

// Accepts an uploaded Excel/CSV file containing a single column of serial
// codes (or full scan URLs), generates a QR code image for each row, and
// streams them back as a downloadable ZIP. The admin can then upload these
// images via the existing "Manage QR Codes" feature on a coupon.
exports.generate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const values = [];
    for (const row of rows) {
      const cell = Array.isArray(row) ? row[0] : row;
      if (isUsableValue(cell)) values.push(String(cell).trim());
    }

    if (values.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid codes or links found in the first column of the uploaded file',
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="qr-codes.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    // Load a font for text rendering
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

    for (let i = 0; i < values.length; i++) {
      const value = values[i];

      // Generate QR code at 300×300
      const qrBuffer = await qrcode.toBuffer(value, { width: 300, margin: 2 });
      const qrImg = await Jimp.read(qrBuffer);

      // Measure text width to center it
      const textWidth = Jimp.measureText(font, value);
      const textHeight = Jimp.measureTextHeight(font, value, 300);
      const padding = 10;
      const canvasWidth = Math.max(300, textWidth + padding * 2);
      const canvasHeight = 300 + textHeight + padding * 2;

      // White canvas
      const canvas = new Jimp(canvasWidth, canvasHeight, 0xffffffff);

      // Place QR centered horizontally
      const qrX = Math.floor((canvasWidth - 300) / 2);
      canvas.composite(qrImg, qrX, 0);

      // Print code text centered below QR
      const textX = Math.floor((canvasWidth - textWidth) / 2);
      canvas.print(font, textX, 300 + padding, value);

      const finalBuffer = await canvas.getBufferAsync(Jimp.MIME_PNG);
      const safeName = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      archive.append(finalBuffer, { name: `${String(i + 1).padStart(3, '0')}_${safeName}.png` });
    }

    await archive.finalize();
  } catch (e) {
    console.error('QR generate error:', e.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: e.message });
  }
};
