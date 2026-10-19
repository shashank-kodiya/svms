import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { stats, listCustomers, listCenters, setCenterStatus, listBookings } from '../controllers/adminController.js';

import { adminRevenue } from '../controllers/revenueController.js';
import { analytics } from '../controllers/analyticsController.js';
import { adminComplaints, adminComplaintMessage, adminResolveComplaint } from '../controllers/feedbackController.js';

const dateRange = [query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/), query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/)];

const router = Router();

// Every route below needs a logged-in admin.
router.use(protect, authorize('admin'));

router.get('/stats', stats);
router.get('/revenue', dateRange, validate, adminRevenue);
router.get('/analytics', dateRange, validate, analytics);
router.get('/complaints', [query('status').optional().isIn(['open', 'responded', 'resolved'])], validate, adminComplaints);
router.post('/complaints/:id/messages', [param('id').isMongoId(), body('text').trim().isLength({ min: 2, max: 1000 }).withMessage('Write your message (up to 1000 characters).')], validate, adminComplaintMessage);
router.patch('/complaints/:id/resolve', [param('id').isMongoId(), body('note').optional({ values: 'falsy' }).trim().isLength({ max: 1000 })], validate, adminResolveComplaint);
router.get('/customers', listCustomers);
router.get('/centers', listCenters);
router.get(
  '/bookings',
  [
    query('status').optional().isString(),
    query('center').optional().isMongoId(),
    query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/)
  ],
  validate,
  listBookings
);
router.patch(
  '/centers/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid service center ID.'),
    body('status').isIn(['verified', 'rejected', 'suspended', 'pending']).withMessage('Choose a valid status.'),
    body('note').optional().trim().isLength({ max: 300 })
  ],
  validate,
  setCenterStatus
);

export default router;
