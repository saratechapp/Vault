// Multipart parsing for POST /api/records/scan — the only route that takes a
// file upload, so multer is wired up here rather than app-wide. Memory
// storage only: the images are handed straight to the vision call and never
// touch disk (see SCAN_ENDPOINT_CONTRACT.md § Privacy).
const multer = require('multer');

// A large bill can be split across up to MAX_FILES pages/photos; the whole
// batch is analysed as ONE transaction and metered as ONE AI scan. The
// mobile client enforces the same ceiling (scan/prepareImage.ts MAX_IMAGES);
// this is the server-side backstop.
const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024; // ~8 MB per part (contract)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES, fields: 4 },
}).array('images', MAX_FILES);

// Runs multer and translates its size/count limit errors into the exact 413
// bodies the mobile client special-cases; anything else falls through to the
// global error handler.
function scanUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'image_too_large' });
      }
      // LIMIT_FILE_COUNT (limits.files) or LIMIT_UNEXPECTED_FILE (> maxCount
      // on .array) — both mean "too many images".
      return res.status(413).json({ error: 'too_many_images' });
    }
    return next(err);
  });
}

module.exports = { scanUpload, MAX_FILES, MAX_BYTES };
