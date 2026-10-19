import { validationResult } from 'express-validator';
import AppError from '../utils/AppError.js';

// Runs after express-validator rules and returns the first problems as a 422.
export const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new AppError(details[0].message, 422, details));
};
