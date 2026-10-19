import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { register, login, me } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Slows down password guessing: 20 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait 15 minutes and try again.' }
});

const isCenter = (value, { req }) => req.body.role === 'service_center';

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name.'),
    body('email').trim().isEmail().withMessage('Enter a valid email address.'),
    body('phone').optional({ values: 'falsy' }).matches(/^[6-9]\d{9}$/).withMessage('Enter a 10-digit Indian mobile number.'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Za-z]/).withMessage('Password must contain a letter.')
      .matches(/\d/).withMessage('Password must contain a number.'),
    body('role').optional().isIn(['customer', 'service_center']).withMessage('Choose customer or service center.'),
    body('center.name').if(isCenter).trim().isLength({ min: 2, max: 120 }).withMessage('Enter the service center name.'),
    body('center.address').if(isCenter).trim().isLength({ min: 5, max: 300 }).withMessage('Enter the full address.'),
    body('center.city').if(isCenter).trim().isLength({ min: 2, max: 60 }).withMessage('Enter the city.'),
    body('center.pincode').if(isCenter).matches(/^\d{6}$/).withMessage('Enter a 6-digit PIN code.'),
    body('center.phone').if(isCenter).matches(/^[6-9]\d{9}$/).withMessage('Enter the center’s 10-digit phone number.')
  ],
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  [body('email').trim().isEmail().withMessage('Enter a valid email address.'), body('password').notEmpty().withMessage('Enter your password.')],
  validate,
  login
);

router.get('/me', protect, me);

export default router;
