import crypto from 'crypto';
import ServiceCenter from '../models/ServiceCenter.js';

// GST on vehicle maintenance and repair services (SAC 998714) is 18%.
export const SERVICE_SAC = '998714';
export const SERVICE_GST = 18;
const PARTS_HSN = '8708'; // parts and accessories of motor vehicles

// All money maths is done in paise (whole numbers) so there are no rounding surprises.
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => paise / 100;

// One invoice line. Within one state (the usual case for a local garage), GST is split
// equally into CGST and SGST. For example 18% GST = 9% CGST + 9% SGST.
function line(kind, description, hsn, qty, rate, gstRate) {
  const amount = toPaise(rate) * qty;
  const gst = Math.round((amount * gstRate) / 100);
  const cgst = Math.floor(gst / 2);
  return { kind, description, hsn, qty, rate, amount, gstRate, cgst, sgst: gst - cgst };
}

// Works out the bill from what was done on the job:
//  1. the booked service (its price was fixed when the customer booked),
//  2. every extra repair the customer APPROVED (parts and labour as separate lines),
//  3. spare parts taken from stock for this job.
// Rejected repairs are never billed.
export function computeBill(booking) {
  const lines = [line('service', booking.service.name, SERVICE_SAC, 1, booking.service.price, SERVICE_GST)];

  for (const r of booking.recommendations || []) {
    if (r.status !== 'approved') continue;
    if (r.partsCost > 0) lines.push(line('repair_parts', `Parts: ${r.problem}`, PARTS_HSN, 1, r.partsCost, 18));
    if (r.labourCost > 0) lines.push(line('repair_labour', `Labour: ${r.problem}`, SERVICE_SAC, 1, r.labourCost, SERVICE_GST));
  }
  for (const p of booking.partsUsed || []) {
    lines.push(line('part', p.partNo ? `${p.name} (${p.partNo})` : p.name, p.hsn || PARTS_HSN, p.qty, p.unitPrice, p.gstRate));
  }

  const taxable = lines.reduce((s, l) => s + l.amount, 0);
  const cgst = lines.reduce((s, l) => s + l.cgst, 0);
  const sgst = lines.reduce((s, l) => s + l.sgst, 0);
  const exact = taxable + cgst + sgst;
  const total = Math.round(exact / 100) * 100; // round to the nearest rupee

  return {
    lines: lines.map((l) => ({ ...l, amount: toRupees(l.amount), cgst: toRupees(l.cgst), sgst: toRupees(l.sgst) })),
    taxable: toRupees(taxable),
    cgst: toRupees(cgst),
    sgst: toRupees(sgst),
    roundOff: toRupees(total - exact),
    total: toRupees(total)
  };
}

// Short code made from the center name: "Kaveri Motor Works" -> "KMW".
const centerCode = (name) => (name.match(/\b[A-Za-z]/g) || ['S']).join('').toUpperCase().slice(0, 4);

// Next invoice number for a center, e.g. KMW-2610-0007. The counter is increased atomically,
// so two bills finalised at the same moment can never get the same number.
export async function nextInvoiceNo(centerId, date) {
  const c = await ServiceCenter.findByIdAndUpdate(centerId, { $inc: { invoiceSeq: 1 } }, { new: true });
  return `${centerCode(c.name)}-${date.slice(2, 4)}${date.slice(5, 7)}-${String(c.invoiceSeq).padStart(4, '0')}`;
}

// Code printed in the invoice QR. Anyone scanning it can check the invoice is genuine,
// because only our server (which knows JWT_SECRET) can produce a matching code.
export function verifyCodeFor(bookingId, invoiceNo, total) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${bookingId}|${invoiceNo}|${total}`).digest('hex').slice(0, 16);
}

export function verifyUrl(booking) {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  return `${base}/verify/${booking._id}?code=${booking.bill.verifyCode}`;
}

// 4-digit pickup code. crypto.randomInt is unpredictable (unlike Math.random).
export const newPickupCode = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

export function codesMatch(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
