import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as c from '../controllers/centerController.js';
import * as cb from '../controllers/centerBookingController.js';
import * as w from '../controllers/workshopController.js';
import * as bl from '../controllers/billingController.js';
import * as pay from '../controllers/paymentController.js';
import { centerRevenue, centerDailyPayments } from '../controllers/revenueController.js';
import * as maps from '../controllers/mapsController.js';
import * as fb from '../controllers/feedbackController.js';
import { UPI_ID, PAYMENT_METHODS } from '../models/ServiceCenter.js';
import { GST_RATES } from '../models/SparePart.js';
import { handleUpload } from '../middleware/upload.js';
import { HEALTH_PARTS, HEALTH_VALUES } from '../models/VehicleHealth.js';
import { URGENCY } from '../models/Booking.js';

// Routes for a logged-in service center managing its own setup.
const router = Router();
router.use(protect, authorize('service_center'));

const phone = (f) => body(f).optional({ values: 'falsy' }).matches(/^[6-9]\d{9}$/).withMessage('Enter a 10-digit mobile number.');

// Profile
router.get('/profile', c.getProfile);
router.patch(
  '/profile',
  [
    body('name').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Enter the center name.'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Keep the description under 500 characters.'),
    body('address').optional().trim().isLength({ min: 5, max: 300 }).withMessage('Enter the full address.'),
    body('city').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Enter the city.'),
    body('pincode').optional().matches(/^\d{6}$/).withMessage('Enter a 6-digit PIN code.'),
    phone('phone'),
    body('gstin').optional({ values: 'falsy' }).trim().toUpperCase().matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).withMessage('Enter a valid 15-character GSTIN (for example 29ABCDE1234F1Z5), or leave it empty.')
  ],
  validate,
  c.updateProfile
);
router.put(
  '/brands',
  [body('Car').optional().isArray().withMessage('Car brands must be a list.'), body('Bike').optional().isArray().withMessage('Bike brands must be a list.')],
  validate,
  c.setBrands
);

// Services and prices
const priceRule = (opt) => (opt ? body('price').optional() : body('price')).isInt({ min: 0, max: 500000 }).withMessage('Enter a price between ₹0 and ₹5,00,000.').toInt();
const durationRule = (opt) => (opt ? body('durationMins').optional() : body('durationMins')).isInt({ min: 15, max: 480 }).withMessage('Duration must be 15 to 480 minutes.').toInt();
router.post(
  '/services',
  [
    body('key').isString().notEmpty().withMessage('Choose a service.'),
    body('vehicleType').isIn(['Car', 'Bike']).withMessage('Choose Car or Bike.'),
    priceRule(false), durationRule(false),
    body('notes').optional().trim().isLength({ max: 200 })
  ],
  validate,
  c.addService
);
router.patch(
  '/services/:serviceId',
  [param('serviceId').isMongoId().withMessage('Invalid service ID.'), priceRule(true), durationRule(true), body('notes').optional().trim().isLength({ max: 200 }), body('isActive').optional().isBoolean().toBoolean()],
  validate,
  c.updateService
);
router.delete('/services/:serviceId', [param('serviceId').isMongoId()], validate, c.deleteService);

// Hours, slot capacity and holidays
router.put('/hours', [body('workingHours').isArray({ min: 7, max: 7 }).withMessage('Send all 7 days.')], validate, c.setHours);
router.put(
  '/slot-settings',
  [
    body('capacityPerSlot').optional().isInt({ min: 1, max: 20 }).withMessage('Vehicles per slot must be 1 to 20.').toInt(),
    body('bookingWindowDays').optional().isInt({ min: 1, max: 90 }).withMessage('Booking window must be 1 to 90 days.').toInt()
  ],
  validate,
  c.setSlotSettings
);
router.post('/holidays', [body('date').isString(), body('reason').optional().trim().isLength({ max: 100 })], validate, c.addHoliday);
router.delete('/holidays/:date', [param('date').matches(/^\d{4}-\d{2}-\d{2}$/)], validate, c.removeHoliday);
router.get('/slots/preview', [query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Choose a valid date.')], validate, c.previewSlots);

// Mechanics (no login for mechanics; managed here)
router.get('/mechanics', c.listMechanics);
router.post(
  '/mechanics',
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter the mechanic’s name.'),
    phone('phone'),
    body('skills').optional().isArray({ max: 10 }),
    body('skills.*').optional().trim().isLength({ min: 1, max: 30 }),
    body('experienceYears').optional({ values: 'falsy' }).isInt({ min: 0, max: 50 }).withMessage('Experience must be 0 to 50 years.').toInt()
  ],
  validate,
  c.addMechanic
);
router.patch(
  '/mechanics/:mechanicId',
  [
    param('mechanicId').isMongoId().withMessage('Invalid mechanic ID.'),
    body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Enter the mechanic’s name.'),
    phone('phone'),
    body('skills').optional().isArray({ max: 10 }),
    body('experienceYears').optional({ values: 'falsy' }).isInt({ min: 0, max: 50 }).toInt(),
    body('isActive').optional().isBoolean().toBoolean()
  ],
  validate,
  c.updateMechanic
);

// Bookings (Phase 4)
router.get(
  '/bookings',
  [
    query('status').optional().matches(/^[a-z_,]+$/),
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/)
  ],
  validate,
  cb.listBookings
);
router.get('/schedule', [query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Choose a valid date.')], validate, cb.schedule);
router.get('/booking-stats', cb.bookingStats);
router.patch('/bookings/:id/accept', [param('id').isMongoId(), body('note').optional().trim().isLength({ max: 300 })], validate, cb.acceptBooking);
router.patch(
  '/bookings/:id/reject',
  [param('id').isMongoId(), body('reason').trim().isLength({ min: 3, max: 300 }).withMessage('Tell the customer why (at least a few words).')],
  validate,
  cb.rejectBooking
);

// Workshop (Phase 5)
const idp = param('id').isMongoId().withMessage('Invalid booking ID.');
router.get('/jobs', w.listJobs);
router.get('/bookings/:id', [idp], validate, w.getJob);
router.patch('/bookings/:id/mechanic', [idp, body('mechanicId').optional({ values: 'null' }).isMongoId().withMessage('Choose a mechanic.')], validate, w.setMechanic);
router.patch(
  '/bookings/:id/status',
  [idp, body('status').isString().withMessage('Choose the next status.'), body('note').optional().trim().isLength({ max: 300 })],
  validate,
  w.advanceStatus
);
router.put(
  '/bookings/:id/inspection',
  [
    idp,
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Keep the notes under 500 characters.'),
    body('km').optional({ values: 'null' }).isInt({ min: 0, max: 2000000 }).withMessage('Enter the odometer reading in km.').toInt(),
    body('items').optional().isObject(),
    ...HEALTH_PARTS.map((p) => body(`items.${p}`).optional().isIn(HEALTH_VALUES).withMessage(`Choose a condition for ${p}.`))
  ],
  validate,
  w.saveInspection
);
router.post(
  '/bookings/:id/recommendations',
  [
    idp,
    body('problem').trim().isLength({ min: 3, max: 120 }).withMessage('Describe the problem (for example "Front brake pads worn").'),
    body('reason').trim().isLength({ min: 3, max: 300 }).withMessage('Explain why it is needed (for example "Pads at 2.5 mm, limit is 3 mm").'),
    body('urgency').isIn(URGENCY).withMessage('Choose High, Medium or Low urgency.'),
    body('partsCost').isInt({ min: 0, max: 500000 }).withMessage('Enter the parts cost in ₹.').toInt(),
    body('labourCost').isInt({ min: 0, max: 500000 }).withMessage('Enter the labour cost in ₹.').toInt()
  ],
  validate,
  w.addRecommendation
);
router.delete('/bookings/:id/recommendations/:recId', [idp, param('recId').isMongoId()], validate, w.deleteRecommendation);
router.patch('/bookings/:id/recommendations/:recId/done', [idp, param('recId').isMongoId()], validate, w.markRecommendationDone);
router.post('/bookings/:id/photos', [idp], validate, handleUpload, w.addPhoto);
router.delete('/bookings/:id/photos/:photoId', [idp, param('photoId').isMongoId()], validate, w.deletePhoto);

// Spare parts, bill and pickup (Phase 6)
const money = (f, opt) => (opt ? body(f).optional() : body(f)).isFloat({ min: 0, max: 500000 }).withMessage('Enter a price between ₹0 and ₹5,00,000.').toFloat();
const count = (f, max, msg) => body(f).optional().isInt({ min: 0, max }).withMessage(msg).toInt();
const partRules = (opt) => [
  (opt ? body('name').optional() : body('name')).trim().isLength({ min: 2, max: 80 }).withMessage('Enter the part name.'),
  body('partNo').optional().trim().isLength({ max: 40 }),
  body('hsn').optional({ values: 'falsy' }).trim().matches(/^\d{4,8}$/).withMessage('HSN code is 4 to 8 digits.'),
  money('unitPrice', opt),
  body('gstRate').optional().isIn(GST_RATES).withMessage('GST must be 0, 5, 12, 18 or 28%.').toInt(),
  count('lowStockAt', 1000, 'Low-stock level must be 0 to 1000.')
];
router.get('/parts', bl.listParts);
router.post('/parts', [...partRules(false), count('stock', 10000, 'Stock must be 0 to 10,000.')], validate, bl.addPart);
router.patch(
  '/parts/:partId',
  [param('partId').isMongoId(), ...partRules(true), body('addStock').optional().isInt({ min: 1, max: 10000 }).withMessage('Received quantity must be 1 to 10,000.').toInt()],
  validate,
  bl.updatePart
);
router.delete('/parts/:partId', [param('partId').isMongoId()], validate, bl.deletePart);

router.post(
  '/bookings/:id/parts',
  [idp, body('partId').isMongoId().withMessage('Choose a part.'), body('qty').isInt({ min: 1, max: 50 }).withMessage('Quantity must be 1 to 50.').toInt()],
  validate,
  bl.addPartToJob
);
router.delete('/bookings/:id/parts/:lineId', [idp, param('lineId').isMongoId()], validate, bl.removePartFromJob);
router.post('/bookings/:id/bill', [idp], validate, bl.finalizeBill);
router.get('/bookings/:id/invoice.pdf', [idp], validate, bl.centerInvoicePdf);
router.post(
  '/bookings/:id/payment',
  [idp, body('paymentMethod').isIn(['cash', 'card', 'upi_counter']).withMessage('Choose how the customer paid.')],
  validate,
  bl.recordCounterPayment
);
router.post(
  '/bookings/:id/handover',
  [
    idp,
    body('otp').matches(/^\d{4}$/).withMessage('Enter the 4-digit pickup code from the customer.'),
    // Not needed when the customer already paid online (Phase 7); the controller checks that.
    body('paymentMethod').optional().isIn(['cash', 'card', 'upi_counter']).withMessage('Choose how the customer paid.')
  ],
  validate,
  bl.handover
);

// Reviews and complaints (Phase 10)
router.get('/reviews', fb.centerReviews);
router.patch('/reviews/:id/reply', [param('id').isMongoId(), body('text').trim().isLength({ min: 2, max: 500 }).withMessage('Write your reply (up to 500 characters).')], validate, fb.replyToReview);
router.get('/complaints', [query('status').optional().isIn(['open', 'responded', 'resolved'])], validate, fb.centerComplaints);
router.post('/complaints/:id/messages', [param('id').isMongoId(), body('text').trim().isLength({ min: 2, max: 1000 }).withMessage('Write your response (up to 1000 characters).')], validate, fb.centerComplaintMessage);

// Showroom photos customers see when they search
router.post('/photos', handleUpload, c.addPhoto);
router.patch('/photos/:photoId/cover', [param('photoId').isMongoId()], validate, c.setCoverPhoto);
router.delete('/photos/:photoId', [param('photoId').isMongoId()], validate, c.deletePhoto);

// Map location (Phase 9)
router.put(
  '/location',
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90.').toFloat(),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180.').toFloat(),
    body('source').optional().isIn(['device', 'map']).withMessage('Location source must be device or map.')
  ],
  validate,
  maps.setLocation
);
router.post('/location/from-address', maps.locationFromAddress);
router.delete('/location', maps.clearLocation);

// Revenue (Phase 7)
router.get('/revenue', [query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/), query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/)], validate, centerRevenue);

// Online payments (Phase 7)
router.get('/payment-settings', pay.getPaymentSettings);
router.put(
  '/payment-settings',
  [
    body('acceptsUpi').isBoolean().withMessage('Choose whether you accept UPI.').toBoolean(),
    body('upiId').optional({ values: 'falsy' }).trim().toLowerCase().matches(UPI_ID).withMessage('Enter a valid UPI ID, for example yourshop@okaxis.'),
    body('payeeName').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 60 }).withMessage('Payee name must be 2 to 60 characters.'),
    body('payBeforePickup').optional().isBoolean().withMessage('Choose whether the bill must be paid before pickup.').toBoolean(),
    body('methods').optional().isArray({ min: 1 }).withMessage('Choose at least one way customers can pay.'),
    body('methods.*').isIn(PAYMENT_METHODS).withMessage('Unknown payment method.')
  ],
  validate,
  pay.updatePaymentSettings
);
router.post('/payment-settings/qr', handleUpload, pay.uploadUpiQr);
router.delete('/payment-settings/qr', pay.removeUpiQr);
// End-of-day settlement: what was collected on one day, by payment method
router.get('/payments/summary', [query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Choose a valid date.')], validate, centerDailyPayments);
router.get('/payments', [query('status').optional().isIn(['submitted', 'confirmed', 'rejected'])], validate, pay.listPayments);
router.patch('/payments/:id/confirm', [param('id').isMongoId()], validate, pay.confirmPayment);
router.patch(
  '/payments/:id/reject',
  [param('id').isMongoId(), body('reason').trim().isLength({ min: 3, max: 300 }).withMessage('Tell the customer why (for example "Amount not received").')],
  validate,
  pay.rejectPayment
);

export default router;
