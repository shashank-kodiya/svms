import { Router } from 'express';
import { BRANDS, VEHICLE_TYPES, FUEL_TYPES, DOCUMENTS } from '../constants/vehicles.js';
import { SERVICE_CATALOG, DAYS } from '../constants/services.js';
import { param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { verifyInvoice } from '../controllers/billingController.js';

// Public lists the forms need. No login required.
const router = Router();

router.get('/vehicle-options', (req, res) => {
  res.json({ types: VEHICLE_TYPES, brands: BRANDS, fuels: FUEL_TYPES, documents: DOCUMENTS });
});

router.get('/service-catalog', (req, res) => {
  res.json({ services: SERVICE_CATALOG, days: DAYS });
});

// Phase 6: anyone scanning the QR on an invoice can check it is genuine.
router.get('/verify-invoice/:id', [param('id').isMongoId().withMessage('Invalid invoice link.')], validate, verifyInvoice);

export default router;
