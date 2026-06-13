const XLSX = require('xlsx');
const archiver = require('archiver');
const qrcode = require('qrcode');

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

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const buffer = await qrcode.toBuffer(value, { width: 300, margin: 1 });
      const safeName = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      archive.append(buffer, { name: `${String(i + 1).padStart(3, '0')}_${safeName}.png` });
    }

    await archive.finalize();
  } catch (e) {
    console.error('QR generate error:', e.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: e.message });
  }
};
