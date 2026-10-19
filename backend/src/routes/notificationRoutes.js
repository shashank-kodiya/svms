import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as n from '../controllers/notificationController.js';

// Every role (customer, service center, admin) has their own notifications.
const router = Router();
router.use(protect);

router.get('/', [query('unread').optional().isBoolean()], validate, n.listNotifications);
router.patch('/read-all', n.markAllRead);
router.get('/preferences', n.getPreferences);
router.put('/preferences', [body('emailNotifications').isBoolean().withMessage('Choose on or off.').toBoolean()], validate, n.setPreferences);
router.patch('/:id/read', [param('id').isMongoId()], validate, n.markRead);

export default router;
