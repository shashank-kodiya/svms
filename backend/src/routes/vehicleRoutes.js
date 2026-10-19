import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { handleUpload } from '../middleware/upload.js';
import { BRANDS, VEHICLE_TYPES, FUEL_TYPES, normaliseReg, isValidReg } from '../constants/vehicles.js';
import {
  listVehicles, getVehicle, createVehicle, updateVehicle, addOdometer,
  setDocuments, uploadVehicleImage, removeVehicleImage, archiveVehicle, vehicleHealth, suggestions
} from '../controllers/vehicleController.js';

const router = Router();
router.use(protect, authorize('customer'));

const maxYear = () => new Date().getFullYear() + 1;
const idRule = param('id').isMongoId().withMessage('Invalid vehicle ID.');
const dateRule = (f) => body(f).optional({ values: 'falsy' }).isISO8601().withMessage('Enter a valid date.');

const detailRules = (optional) => {
  const o = (chain) => (optional ? chain.optional() : chain);
  return [
    o(body('type')).isIn(VEHICLE_TYPES).withMessage('Choose Car or Bike.'),
    o(body('brand')).custom((brand, { req }) => {
      const type = req.body.type;
      if (type && !BRANDS[type]?.includes(brand)) throw new Error(`Choose a ${type ? type.toLowerCase() : 'vehicle'} brand from the list.`);
      if (!type && !Object.values(BRANDS).flat().includes(brand)) throw new Error('Choose a brand from the list.');
      return true;
    }),
    o(body('model')).trim().isLength({ min: 1, max: 60 }).withMessage('Enter the model, for example Creta.'),
    body('variant').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
    o(body('year')).isInt({ min: 1990, max: maxYear() }).withMessage(`Enter a year between 1990 and ${maxYear()}.`).toInt(),
    o(body('regNumber')).custom((v) => {
      if (!isValidReg(normaliseReg(v))) throw new Error('Enter a valid registration number, like KA 09 MB 4821.');
      return true;
    }),
    o(body('fuel')).isIn(FUEL_TYPES).withMessage('Choose a fuel type.')
  ];
};

router.get('/', listVehicles);

router.post(
  '/',
  [
    ...detailRules(false),
    body('km').isInt({ min: 0, max: 2000000 }).withMessage('Enter the current odometer reading in km.').toInt(),
    dateRule('documents.insuranceExpiry'), dateRule('documents.pucExpiry'), dateRule('documents.rcExpiry')
  ],
  validate,
  createVehicle
);

router.get('/suggestions', suggestions); // before '/:id' so "suggestions" is not read as an ID
router.get('/:id', [idRule], validate, getVehicle);
router.get('/:id/health', [idRule], validate, vehicleHealth);
router.patch('/:id', [idRule, ...detailRules(true)], validate, updateVehicle);
router.delete('/:id', [idRule], validate, archiveVehicle);

router.post(
  '/:id/odometer',
  [idRule, body('km').isInt({ min: 0, max: 2000000 }).withMessage('Enter the odometer reading in km.').toInt()],
  validate,
  addOdometer
);

router.put('/:id/documents', [idRule, dateRule('insuranceExpiry'), dateRule('pucExpiry'), dateRule('rcExpiry')], validate, setDocuments);

router.post('/:id/image', [idRule], validate, handleUpload, uploadVehicleImage);
router.delete('/:id/image', [idRule], validate, removeVehicleImage);

export default router;
