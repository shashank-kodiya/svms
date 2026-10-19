import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import PaymentRequests from '../../components/PaymentRequests.jsx';
import api, { errorMessage } from '../../api/client.js';

export default function CenterPayments() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/center/payment-settings')
      .then(({ data }) => setForm({ acceptsUpi: !!data.acceptsUpi, upiId: data.upiId || '', payeeName: data.payeeName || '' }))
      .catch((e) => setMsg({ tone: 'bad', text: errorMessage(e) }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.put('/center/payment-settings', form);
      setMsg({ tone: 'good', text: form.acceptsUpi ? 'Saved. Customers can now pay their bill by UPI.' : 'Saved. Customers will pay at the counter.' });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Payments" subtitle="Take UPI payments from customers and confirm them here.">
      <div className="card">
        <h3>Online payment settings</h3>
        {!form ? <p className="muted">Loading…</p> : (
          <form className="list" onSubmit={save} noValidate>
            <label className="row"><input type="checkbox" checked={form.acceptsUpi} onChange={(e) => setForm({ ...form, acceptsUpi: e.target.checked })} /> <span>Accept UPI payments for final bills</span></label>
            <div className="fgrid">
              <label className="field"><span>UPI ID</span><input value={form.upiId} disabled={!form.acceptsUpi} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="yourshop@okaxis" autoComplete="off" /></label>
              <label className="field"><span>Name shown to customers</span><input value={form.payeeName} disabled={!form.acceptsUpi} maxLength={60} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} placeholder="Kaveri Motor Works" /></label>
            </div>
            <p className="small muted">Demo payments: the customer pays your UPI ID from their own app and sends you the reference number. You check your account and confirm. Cash, card and UPI at the counter still work at handover.</p>
            <div className="row"><button className="btn primary" disabled={busy}>Save settings</button></div>
          </form>
        )}
        <Notice msg={msg} />
      </div>

      <div className="card">
        <h3>Payments waiting for you</h3>
        <PaymentRequests />
      </div>
    </Layout>
  );
}
