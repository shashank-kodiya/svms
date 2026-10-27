import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as t from '../controllers/towingController.js';

// Roadside help: centers set up their tow trucks; customers stuck on the road find them and request a tow.
const router = Router();

router.use(protect);

const phoneRule = (f) => body(f).customSanitizer((v) => String(v || '').replace(/[\s-]/g, '')).matches(/^(\+?91)?0?\d{10}$/).withMessage('Enter a valid phone number, for example 9876543210.');
const latLng = (loc) => [
  loc('lat').isFloat({ min: -90, max: 90 }).withMessage('Your location is not valid.').toFloat(),
  loc('lng').isFloat({ min: -180, max: 180 }).withMessage('Your location is not valid.').toFloat()
];

// ---- Service center ----
const center = authorize('service_center');
router.get('/center', center, t.getTowing);
router.put(
  '/center',
  center,
  [
    body('enabled').isBoolean().toBoolean(),
    body('radiusKm').optional().isInt({ min: 1, max: 200 }).withMessage('Towing area must be 1 to 200 km.').toInt(),
    body('available24x7').optional().isBoolean().toBoolean(),
    body('charges').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Keep the charges note under 200 characters.'),
    body('contacts').optional().isArray({ max: 10 }).withMessage('Add up to 10 tow trucks.'),
    body('contacts.*.name').trim().isLength({ min: 2, max: 60 }).withMessage('Enter a name for each tow truck contact.'),
    phoneRule('contacts.*.phone'),
    body('contacts.*.vehicleType').optional().isIn(t.TOW_VEHICLE_TYPES).withMessage('Choose the truck type.')
  ],
  validate,
  t.updateTowing
);
router.get('/center/requests', center, [query('status').optional().isIn(['open', 'history', 'all'])], validate, t.centerTowRequests);
router.get('/center/requests/:id/route', center, [param('id').isMongoId()], validate, t.towRoute);
router.patch(
  '/center/requests/:id',
  center,
  [
    param('id').isMongoId(),
    body('status').isIn(['accepted', 'on_the_way', 'completed', 'declined']).withMessage('Choose a valid status.'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 300 })
  ],
  validate,
  t.updateTowRequest
);

// ---- Customer ----
const customer = authorize('customer');
// Stops one account sending a burst of tow requests.
const requestLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, keyGenerator: (req) => String(req.user._id), standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many tow requests. Please call the center directly.' } });

router.get('/nearby', customer, [...latLng(query), query('bookingId').optional().isMongoId()], validate, t.towingNearby);
router.get('/requests', customer, t.myTowRequests);
router.post(
  '/requests',
  customer,
  requestLimiter,
  [
    body('centerId').isMongoId().withMessage('Choose a center.'),
    ...latLng(body),
    phoneRule('phone'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 300 }).withMessage('Keep the note under 300 characters.'),
    body('bookingId').optional({ values: 'falsy' }).isMongoId(),
    body('vehicleId').optional({ values: 'falsy' }).isMongoId()
  ],
  validate,
  t.createTowRequest
);
router.patch('/requests/:id/cancel', customer, [param('id').isMongoId()], validate, t.cancelTowRequest);

export default router;
