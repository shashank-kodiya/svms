// How a center takes payment, as small chips: "Cash · UPI · Card".
export const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: '₹' },
  { key: 'upi', label: 'UPI', icon: '⚡' },
  { key: 'card', label: 'Card (POS)', icon: '💳' },
  { key: 'netbanking', label: 'Net banking', icon: '🏦' },
  { key: 'emi', label: 'EMI', icon: '📅' }
];

export default function PaymentMethods({ methods, label = 'Pay by' }) {
  if (!methods?.length) return null;
  const list = PAYMENT_METHODS.filter((m) => methods.includes(m.key));
  return (
    <div className="pay-methods small">
      {label && <span className="muted">{label}</span>}
      {list.map((m) => <span key={m.key} className="chip pay-method"><span aria-hidden="true">{m.icon}</span> {m.label}</span>)}
    </div>
  );
}
