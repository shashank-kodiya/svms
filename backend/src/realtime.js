import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import ServiceCenter from './models/ServiceCenter.js';

// Live updates with Socket.IO.
// - Anyone looking at a center's slots for a date joins "slots:<centerId>:<date>" and is told when they change.
// - A logged-in service center joins "center:<centerId>" and is told about new or changed bookings.
let io = null;

export function initRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // guests can still watch slot availability
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = payload;
      socket.join(`user:${payload.id}`); // Phase 8: personal room for notifications (every role)
      if (payload.role === 'service_center') {
        const center = await ServiceCenter.findOne({ owner: payload.id }).select('_id').lean();
        if (center) socket.join(`center:${center._id}`);
      }
      if (payload.role === 'customer') socket.join(`customer:${payload.id}`);
      next();
    } catch {
      next(); // bad token: treat as a guest
    }
  });

  io.on('connection', (socket) => {
    socket.on('slots:watch', ({ centerId, date } = {}) => {
      if (/^[a-f0-9]{24}$/.test(String(centerId)) && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        socket.join(`slots:${centerId}:${date}`);
      }
    });
    socket.on('slots:unwatch', ({ centerId, date } = {}) => socket.leave(`slots:${centerId}:${date}`));
  });
  return io;
}

export function emitSlotsChanged(centerId, date) {
  io?.to(`slots:${centerId}:${date}`).emit('slots:changed', { centerId: String(centerId), date });
}

// Phase 8: the notification service listens to every booking event, so controllers don't need to change.
let bookingListener = null;
export const onBookingEvent = (fn) => { bookingListener = fn; };
const tell = (event) => Promise.resolve(bookingListener?.(event)).catch((err) => console.warn(`Notification not created: ${err.message}`));

export function emitBookingToCenter(centerId, booking, kind) {
  io?.to(`center:${centerId}`).emit('booking:changed', { kind, bookingNo: booking.bookingNo, id: String(booking._id) });
  tell({ to: 'center', centerId, booking, kind });
}

export function emitBookingToCustomer(customerId, booking, kind) {
  io?.to(`customer:${customerId}`).emit('booking:changed', { kind, bookingNo: booking.bookingNo, id: String(booking._id), status: booking.status });
  tell({ to: 'customer', customerId, booking, kind });
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
