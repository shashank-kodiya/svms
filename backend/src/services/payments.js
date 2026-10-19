import QRCode from 'qrcode';

// UPI payment link. Any UPI app opens it with the payee and the amount already filled in.
export function upiLink(center, bill) {
  const { upiId, payeeName } = center.paymentSettings;
  const q = new URLSearchParams({
    pa: upiId,
    pn: payeeName || center.name,
    am: bill.total.toFixed(2),
    cu: 'INR',
    tn: `Invoice ${bill.invoiceNo}`,
    tr: bill.invoiceNo
  });
  return `upi://pay?${q.toString()}`;
}

export const upiQr = (link) => QRCode.toDataURL(link, { margin: 1, width: 240 });
