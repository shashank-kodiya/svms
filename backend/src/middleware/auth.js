import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError, { asyncHandler } from '../utils/AppError.js';

// Checks the "Authorization: Bearer <token>" header and loads the user.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Please log in to continue.', 401);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Your session has expired. Please log in again.', 401);
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new AppError('This account is not available.', 401);
  req.user = user;
  next();
});

// Allows only the listed roles, e.g. authorize('admin').
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to do this.', 403));
  }
  next();
};
