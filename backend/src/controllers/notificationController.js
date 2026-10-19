import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/AppError.js';
import AppError from '../utils/AppError.js';
import { emailReady } from '../services/email.js';

// GET /api/notifications?unread=true   Newest first, with the unread count for the bell.
export const listNotifications = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(60).lean(),
    Notification.countDocuments({ user: req.user._id, readAt: null })
  ]);
  res.json({ items, unread });
});

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id, readAt: null }, { $set: { readAt: new Date() } }, { new: true });
  if (!n && !(await Notification.exists({ _id: req.params.id, user: req.user._id }))) throw new AppError('Notification not found.', 404);
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) });
});

// PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ unread: 0 });
});

// GET /api/notifications/preferences
export const getPreferences = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select('emailNotifications email').lean();
  res.json({ emailNotifications: u.emailNotifications !== false, email: u.email, emailConfigured: emailReady() });
});

// PUT /api/notifications/preferences   body: { emailNotifications }
export const setPreferences = asyncHandler(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.user._id, { $set: { emailNotifications: req.body.emailNotifications } }, { new: true }).select('emailNotifications');
  res.json({ emailNotifications: u.emailNotifications });
});
