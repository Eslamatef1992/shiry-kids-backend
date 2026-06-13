const multer = require('multer');
const path = require('path');

// In-memory upload for spreadsheet files used by the QR code generator.
// The file is parsed immediately and never written to disk.
const fileFilter = (req, file, cb) => {
  const allowed = /\.(xlsx|xls|csv)$/i;
  cb(null, allowed.test(path.extname(file.originalname)));
};

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = uploadExcel;
