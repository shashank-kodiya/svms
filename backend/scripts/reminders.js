// Runs today's reminders once, right now (the server also does this by itself every day at 9 AM India time).
// Handy for testing:  npm run reminders
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import '../src/models/Notification.js';
import { runReminders } from '../src/services/reminders.js';
import { runPaymentReminders } from '../src/services/paymentReminders.js';

await connectDB(process.env.MONGO_URI);
const r = await runReminders();
console.log(`Checked ${r.vehicles} vehicles. New reminders: ${r.documents} document, ${r.service} service.`);
const p = await runPaymentReminders();
console.log(`Checked ${p.checked} unpaid bills. Payment reminders: ${p.customer} to customers, ${p.center} to centers.`);
await mongoose.disconnect();
