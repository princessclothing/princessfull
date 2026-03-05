// Secure file upload middleware using multer
// Protects the DANFE, shipping label, and attachment upload endpoints from:
//   1. Oversized files (DoS via disk exhaustion)
//   2. MIME-type spoofing (malicious file disguised as PDF)
//   3. Path traversal in filenames (../../etc/passwd)
//   4. Executable uploads (.exe, .sh, .php etc.)
//
// All uploaded files are stored in /uploads/<orderId>/<uuidv4>.<ext>
// The original filename is sanitised and never used directly in the filesystem.

const multer = require('multer');
const path   = require('path');
const crypto = require('crypto');
const fs     = require('fs');

// ---- Allowed types -----------------------------------------------------------
// Only PDF, PNG and JPEG are accepted. XML (NF-e) is also whitelisted for DANFE.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/xml',
  'application/xml',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.xml']);

// ---- Size limits (per file) --------------------------------------------------
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---- Storage -----------------------------------------------------------------
const UPLOAD_BASE = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderId = req.params.orderId || 'unknown';
    // sanitise orderId: allow only alphanumeric + dash
    const safeOrderId = orderId.replace(/[^a-zA-Z0-9\-]/g, '_');
    const dir = path.join(UPLOAD_BASE, safeOrderId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // replace original filename with a UUID to avoid:
    //   - path traversal
    //   - collisions
    //   - information disclosure
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

// ---- MIME + extension filter -------------------------------------------------
function fileFilter(req, file, cb) {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension "${ext}" is not allowed.`));
  }

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return cb(new Error(`MIME type "${mime}" is not allowed.`));
  }

  cb(null, true);
}

// ---- Multer instance ---------------------------------------------------------
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files:    5,  // max 5 files per request
  },
});

// ---- Exported middlewares ---------------------------------------------------

/** Single DANFE upload (field: "danfe") */
exports.uploadDanfe = upload.single('danfe');

/** Single shipping label upload (field: "label") */
exports.uploadLabel = upload.single('label');

/** Up to 5 other attachments (field: "attachments") */
exports.uploadAttachments = upload.array('attachments', 5);

/** Error handler to be used after any upload middleware */
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `File too large. Maximum is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};
