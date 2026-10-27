import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { verifyUrl } from './billing.js';
import { acceptedMethods } from '../models/ServiceCenter.js';

const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', netbanking: 'Net banking', emi: 'EMI' };

// The built-in PDF fonts have no ₹ sign, so the PDF writes "Rs.".
const rs = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Builds the tax invoice PDF and streams it to the response.
// booking must have center, customer and vehicle populated and a final bill.
export async function sendInvoicePdf(res, booking) {
  const b = booking;
  const bill = b.bill;
  const qr = await QRCode.toBuffer(verifyUrl(b), { margin: 1, width: 220 });

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${bill.invoiceNo}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${bill.invoiceNo}.pdf"`);
  doc.pipe(res);

  const L = 40;
  const W = doc.page.width - 80;
  const ink = '#1f2a37';
  const soft = '#5b6675';

  // Header: center details on the left, invoice details on the right
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(18).text(b.center.name, L, 40, { width: 330 });
  doc.font('Helvetica').fontSize(9).fillColor(soft)
    .text(`${b.center.address}, ${b.center.city} ${b.center.pincode}`, { width: 330 })
    .text(`Phone ${b.center.phone}${b.center.gstin ? `   GSTIN ${b.center.gstin}` : ''}`, { width: 330 });

  doc.font('Helvetica-Bold').fontSize(14).fillColor(ink).text('TAX INVOICE', 380, 40, { width: W - 340, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(soft)
    .text(`Invoice no. ${bill.invoiceNo}`, 380, 60, { width: W - 340, align: 'right' })
    .text(`Date ${fmtDate(bill.issuedAt)}`, { width: W - 340, align: 'right' })
    .text(`Booking ${b.bookingNo}`, { width: W - 340, align: 'right' });

  doc.moveTo(L, 112).lineTo(L + W, 112).strokeColor('#d6dbe1').stroke();

  // Bill to / vehicle
  doc.font('Helvetica-Bold').fontSize(9).fillColor(soft).text('BILL TO', L, 122).text('VEHICLE', 320, 122);
  doc.font('Helvetica').fontSize(10).fillColor(ink)
    .text(b.customer.name, L, 136).text(b.customer.phone || b.customer.email, L, 150);
  doc.text(`${b.vehicleSnapshot.brand} ${b.vehicleSnapshot.model}`, 320, 136)
    .text(`Reg. ${b.vehicleSnapshot.regNumber}`, 320, 150);

  // Line items table
  const cols = [
    { h: '#', w: 22, a: 'left' }, { h: 'Description', w: 190, a: 'left' }, { h: 'HSN/SAC', w: 52, a: 'left' },
    { h: 'Qty', w: 30, a: 'right' }, { h: 'Rate', w: 70, a: 'right' }, { h: 'GST', w: 36, a: 'right' },
    { h: 'Tax', w: 55, a: 'right' }, { h: 'Amount', w: W - 455, a: 'right' }
  ];
  let y = 182;
  const row = (cells, bold = false) => {
    let x = L;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(ink);
    const h = Math.max(...cells.map((c, i) => doc.heightOfString(String(c), { width: cols[i].w - 4 })));
    cells.forEach((c, i) => { doc.text(String(c), x + 2, y, { width: cols[i].w - 4, align: cols[i].a }); x += cols[i].w; });
    y += h + 7;
  };
  doc.rect(L, y - 5, W, 20).fill('#eef1f4');
  row(cols.map((c) => c.h), true);
  bill.lines.forEach((l, i) => {
    row([i + 1, l.description, l.hsn || '', l.qty, rs(l.rate), `${l.gstRate}%`, rs(l.cgst + l.sgst), rs(l.amount)]);
    doc.moveTo(L, y - 3).lineTo(L + W, y - 3).strokeColor('#eef1f4').stroke();
  });

  // Totals
  y += 6;
  const total = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(ink)
      .text(label, 330, y, { width: 120 }).text(value, 450, y, { width: L + W - 450, align: 'right' });
    y += bold ? 20 : 15;
  };
  total('Taxable value', rs(bill.taxable));
  total('CGST', rs(bill.cgst));
  total('SGST', rs(bill.sgst));
  if (bill.roundOff) total('Round off', rs(bill.roundOff));
  doc.moveTo(330, y).lineTo(L + W, y).strokeColor(ink).stroke();
  y += 6;
  total('Total', rs(bill.total), true);
  const paid = bill.payment?.status === 'paid';
  doc.font('Helvetica').fontSize(9).fillColor(paid ? '#1a7f4b' : '#a15c00')
    .text(paid ? `Paid (${bill.payment.method.replace('_', ' ')}${bill.payment.reference ? `, ref ${bill.payment.reference}` : ''}) on ${fmtDate(bill.payment.paidAt)}` : 'Payment due at pickup', 330, y, { width: L + W - 330, align: 'right' });

  doc.fillColor(soft).text(`Payment accepted: ${acceptedMethods(b.center).map((m) => METHOD_LABEL[m]).join(', ')}`, 330, y + 14, { width: L + W - 330, align: 'right' });

  // QR code to check the invoice is genuine
  const qy = y + 48;
  doc.image(qr, L, qy, { width: 96 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(ink).text('Scan to verify this invoice', L + 108, qy + 22);
  doc.font('Helvetica').fontSize(8).fillColor(soft)
    .text('The QR opens our website and confirms the invoice number, date and total.', L + 108, qy + 36, { width: 260 })
    .text('GST split as CGST + SGST (supply within the state).', L + 108, qy + 60, { width: 260 });

  doc.fontSize(8).fillColor(soft).text('This is a computer-generated invoice. Thank you for your visit.', L, 790, { width: W, align: 'center' });
  doc.end();
}
