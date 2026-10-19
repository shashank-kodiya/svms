import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as b from '../controllers/bookingController.js';
import * as bl from '../controllers/billingController.js';
import * as pay from '../controllers/paymentController.js';
import * as fb from '../controllers/feedbackController.js';
import { COMPLAINT_CATEGORIES } from '../models/Complaint.js';

// Customer booking routes.
const router = Router();
router.use(protect, authorize('customer'));

const dateRule = (loc) => loc('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Choose a valid date.');
const slotRule = body('slot').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Choose a time slot.');

// Stops one account hammering the booking endpoint.
const bookingLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, keyGenerator: (req) => String(req.user._id), standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many booking attempts. Please wait a minute.' } });

router.get(
  '/search',
  [query('vehicleId').isMongoId().withMessage('Choose a vehicle.'), query('serviceKey').isString().notEmpty().withMessage('Choose a service.'), dateRule(query), query('city').optional().trim().isLength({ max: 60 }),
    query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Your location is not valid.').toFloat(),
    query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Your location is not valid.').toFloat()],
  validate,
  b.searchCenters
);
router.get('/availability/:centerId', [param('centerId').isMongoId(), dateRule(query)], validate, b.centerAvailability);

router.get('/', b.myBookings);
router.post(
  '/',
  bookingLimiter,
  [
    body('vehicleId').isMongoId().withMessage('Choose a vehicle.'),
    body('centerId').isMongoId().withMessage('Choose a service center.'),
    body('serviceKey').isString().notEmpty().withMessage('Choose a service.'),
    dateRule(body), slotRule,
    body('problem').optional().trim().isLength({ max: 500 }).withMessage('Keep the description under 500 characters.')
  ],
  validate,
  b.createBooking
);
router.get('/:id', [param('id').isMongoId()], validate, b.getBooking);
router.patch(
  '/:id/recommendations/:recId',
  [param('id').isMongoId(), param('recId').isMongoId(), body('decision').isIn(['approved', 'rejected']).withMessage('Choose approve or reject.')],
  validate,
  b.decideRecommendation
);
router.patch('/:id/cancel', bookingLimiter, [param('id').isMongoId(), body('reason').optional().trim().isLength({ max: 300 })], validate, b.cancelBooking);
router.patch('/:id/reschedule', bookingLimiter, [param('id').isMongoId(), dateRule(body), slotRule], validate, b.rescheduleBooking);

// Phase 6
router.get('/:id/invoice.pdf', [param('id').isMongoId()], validate, bl.customerInvoicePdf);
router.post('/:id/pickup-code', bookingLimiter, [param('id').isMongoId()], validate, bl.newCustomerPickupCode);

// Phase 7: pay the bill online (demo UPI)
router.get('/:id/pay', [param('id').isMongoId()], validate, pay.payInfo);
router.post(
  '/:id/payments',
  bookingLimiter,
  [param('id').isMongoId(), body('reference').trim().matches(/^\d{12}$/).withMessage('Enter the 12-digit UPI reference number (UTR) from your payment app.')],
  validate,
  pay.submitPayment
);

// Phase 10: reviews and complaints
const text = (f, min, max, msg) => body(f).trim().isLength({ min, max }).withMessage(msg);
router.get('/centers/:centerId/reviews', [param('centerId').isMongoId()], validate, fb.publicReviews);
router.get('/:id/feedback', [param('id').isMongoId()], validate, fb.bookingFeedback);
router.post(
  '/:id/review',
  bookingLimiter,
  [param('id').isMongoId(), body('rating').isInt({ min: 1, max: 5 }).withMessage('Choose 1 to 5 stars.').toInt(), body('comment').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Keep the comment under 500 characters.')],
  validate,
  fb.createReview
);
router.post(
  '/:id/complaints',
  bookingLimiter,
  [param('id').isMongoId(), body('category').isIn(COMPLAINT_CATEGORIES).withMessage('Choose what the complaint is about.'), text('description', 10, 1000, 'Describe the problem in at least 10 characters.')],
  validate,
  fb.createComplaint
);
router.post('/:id/complaints/:cid/messages', bookingLimiter, [param('id').isMongoId(), param('cid').isMongoId(), text('text', 2, 1000, 'Write your message (up to 1000 characters).')], validate, fb.customerComplaintMessage);
router.patch('/:id/complaints/:cid/resolve', [param('id').isMongoId(), param('cid').isMongoId()], validate, fb.customerResolveComplaint);

export default router;
