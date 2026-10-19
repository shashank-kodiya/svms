import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ServiceCenter from '../models/ServiceCenter.js';
import AppError, { asyncHandler } from '../utils/AppError.js';

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

async function profileFor(user) {
  if (user.role !== 'service_center') return null;
  return ServiceCenter.findOne({ owner: user._id }); // not lean, so the 'setup' checklist is included
}

// POST /api/auth/register
// Customers and service centers can sign up. Admins are created only by the seed script.
export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role = 'customer', center } = req.body;
  if (!['customer', 'service_center'].includes(role)) {
    throw new AppError('You can register only as a customer or a service center.', 400);
  }
  if (await User.exists({ email: email.toLowerCase() })) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const user = await User.create({ name, email, phone, password, role });
  if (role === 'service_center') {
    try {
      await ServiceCenter.create({ ...center, owner: user._id });
    } catch (err) {
      // Undo the user so we never keep half an account.
      await User.deleteOne({ _id: user._id });
      throw err;
    }
  }

  res.status(201).json({ token: signToken(user), user: user.toSafeJSON(), center: await profileFor(user) });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Email or password is incorrect.', 401);
  }
  if (!user.isActive) throw new AppError('This account has been disabled. Contact the admin.', 403);
  res.json({ token: signToken(user), user: user.toSafeJSON(), center: await profileFor(user) });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON(), center: await profileFor(req.user) });
});
