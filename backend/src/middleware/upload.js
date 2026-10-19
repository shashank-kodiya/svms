import multer from 'multer';
import AppError from '../utils/AppError.js';

// Keeps the file in memory (never on the server's disk) and allows only small images.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    cb(new AppError('Upload a JPG, PNG or WebP image.', 400));
  }
}).single('image');

// Turns multer's errors into friendly messages.
export const handleUpload = (req, res, next) =>
  imageUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('The photo must be smaller than 2 MB.', 400));
    next(err);
  });
