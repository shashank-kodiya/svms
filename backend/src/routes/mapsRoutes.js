import { Router } from 'express';
import { param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as m from '../controllers/mapsController.js';

// Map features for customers. Google calls cost money, so each customer is limited per minute.
const router = Router();
router.use(protect, authorize('customer'));

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 40, keyGenerator: (req) => String(req.user._id), standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many map requests. Please wait a minute.' } });

const lat = (loc, opt) => (opt ? loc('lat').optional() : loc('lat')).isFloat({ min: -90, max: 90 }).withMessage('Your location is not valid.').toFloat();
const lng = (loc, opt) => (opt ? loc('lng').optional() : loc('lng')).isFloat({ min: -180, max: 180 }).withMessage('Your location is not valid.').toFloat();
const radius = query('radiusKm').optional().isFloat({ min: 0.5, max: 300 }).withMessage('Choose a distance from 0.5 to 300 km.').toFloat();

router.get('/status', m.status);
router.get('/centers', [lat(query, true), lng(query, true), radius], validate, m.centersOnMap);
router.get('/centers/:id', limiter, [param('id').isMongoId().withMessage('Service center not found.')], validate, m.centerDetails);
router.get('/route', limiter, [query('centerId').isMongoId(), lat(query), lng(query)], validate, m.routeToCenter);
router.get('/places', limiter, [lat(query), lng(query), radius], validate, m.otherGarages);

export default router;
