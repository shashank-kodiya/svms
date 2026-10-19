import { inr2, PAY_METHODS } from '../utils/booking.js';

// The bill as a table: one row per line, then taxable value, CGST, SGST and total.
// Used for the live preview (center) and the final bill (center and customer).
export default function BillTable({ bill, preview = false, bookingId }) {
  if (!bill) return null;
  const paid = bill.payment?.status === 'paid';
  return (
    <div className="bill">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Item</th><th className="num opt">Qty</th><th className="num opt">Rate</th><th className="num opt">GST</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {bill.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.description}{l.hsn && <span className="muted small opt"> · {l.kind === 'service' || l.kind === 'repair_labour' ? 'SAC' : 'HSN'} {l.hsn}</span>}
                  <div className="muted small only-sm">{l.qty} × {inr2(l.rate)} · GST {l.gstRate}%</div>
                </td>
                <td className="num opt">{l.qty}</td>
                <td className="num opt">{inr2(l.rate)}</td>
                <td className="num opt">{l.gstRate}%</td>
                <td className="num">{inr2(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="bill-totals">
        <dt>Taxable value</dt><dd>{inr2(bill.taxable)}</dd>
        <dt>CGST</dt><dd>{inr2(bill.cgst)}</dd>
        <dt>SGST</dt><dd>{inr2(bill.sgst)}</dd>
        {bill.roundOff !== 0 && <><dt>Round off</dt><dd>{inr2(bill.roundOff)}</dd></>}
        <dt className="total">{preview ? 'Total so far' : 'Total'}</dt><dd className="total">{inr2(bill.total)}</dd>
      </dl>
      {!preview && (
        <div className="row between small">
          <span><span className="mono">Invoice {bill.invoiceNo}</span>{bookingId && bill.verifyCode && <> · <a href={`/verify/${bookingId}?code=${bill.verifyCode}`} target="_blank" rel="noreferrer">Open the QR link</a></>}</span>
          <span className={`chip ${paid ? 'good' : 'warn'}`}>{paid ? `Paid · ${PAY_METHODS[bill.payment.method]}${bill.payment.reference ? ` · Ref ${bill.payment.reference}` : ''}` : 'Payment due at pickup'}</span>
        </div>
      )}
    </div>
  );
}
