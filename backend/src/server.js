import 'dotenv/config';
import http from 'node:http';
import { createApp, allowedOrigins } from './app.js';
import { initRealtime } from './realtime.js';
import { connectDB, ensureIndexes } from './config/db.js';
import { registerBookingNotifications } from './services/notifications.js';
import { startReminderScheduler } from './services/reminders.js';
// Load every model so ensureIndexes() knows about them.
import './models/SlotSeat.js';
import './models/Booking.js';
import './models/VehicleHealth.js';
import './models/Payment.js';
import './models/Notification.js';
import './models/Review.js';
import './models/Complaint.js';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('replace-with')) {
  console.error('JWT_SECRET is not set. Add a long random value to backend/.env');
  process.exit(1);
}

connectDB(process.env.MONGO_URI)
  .then(ensureIndexes)
  .then(() => {
    // One HTTP server carries both the REST API and Socket.IO live updates.
    const server = http.createServer(createApp());
    initRealtime(server, allowedOrigins());
    registerBookingNotifications();   // Phase 8: booking events also become notifications
    startReminderScheduler();         // Phase 8: daily document / service reminders
    server.listen(PORT, () => console.log(`API running on http://localhost:${PORT} (live updates on)`));
  })
  .catch((err) => {
    console.error('Could not start:', err.message);
    console.error('If this is a connection error, check MONGO_URI in backend/.env and that your IP is allowed in Atlas > Network Access.');
    process.exit(1);
  });
