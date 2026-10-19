import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import useCenterProfile, { serviceName } from '../../hooks/useCenterProfile.js';
import { errorMessage } from '../../api/client.js';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const hrs = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

function ServiceRow({ s, catalog, save, onMsg }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(s.price);
  const [duration, setDuration] = useState(s.durationMins);
  const [confirmDel, setConfirmDel] = useState(false);

  const run = async (method, body, ok) => {
    try {
      await save(method, `/center/services/${s._id}`, body);
      onMsg({ tone: 'good', text: ok });
      setEditing(false);
    } catch (err) {
      onMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  return (
    <tr className={s.isActive ? '' : 'off'}>
      <td><b>{serviceName(catalog, s.key)}</b>{s.notes && <div className="small muted">{s.notes}</div>}</td>
      <td className="num">
        {editing ? <input className="mini" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price" /> : inr(s.price)}
      </td>
      <td className="num">
        {editing ? <input className="mini" type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration in minutes" /> : hrs(s.durationMins)}
      </td>
      <td><span className={`chip ${s.isActive ? 'good' : ''}`}>{s.isActive ? 'Offered' : 'Paused'}</span></td>
      <td>
        <div className="row nowrap">
          {editing ? (
            <>
              <button className="btn primary sm" onClick={() => run('patch', { price: Number(price), durationMins: Number(duration) }, 'Price updated.')}>Save</button>
              <button className="btn sm" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : confirmDel ? (
            <>
              <button className="btn bad sm" onClick={() => run('delete', undefined, 'Service removed.')}>Remove</button>
              <button className="btn sm" onClick={() => setConfirmDel(false)}>Keep</button>
            </>
          ) : (
            <>
              <button className="btn sm" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn sm" onClick={() => run('patch', { isActive: !s.isActive }, s.isActive ? 'Service paused.' : 'Service offered again.')}>{s.isActive ? 'Pause' : 'Offer'}</button>
              <button className="btn sm ghost" onClick={() => setConfirmDel(true)}>Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function CenterServices() {
  const { center, catalog, error, save } = useCenterProfile();
  const [form, setForm] = useState({ vehicleType: 'Car', key: '', price: '', durationMins: 60, notes: '' });
  const [msg, setMsg] = useState(null);
  const [listMsg, setListMsg] = useState(null);

  const types = center ? ['Car', 'Bike'].filter((t) => center.brands?.[t]?.length) : [];
  const offered = (type) => (center?.services || []).filter((s) => s.vehicleType === type);
  const available = (catalog?.services || []).filter(
    (s) => s.types.includes(form.vehicleType) && !offered(form.vehicleType).some((o) => o.key === s.key)
  );

  const add = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!form.key) return setMsg({ tone: 'bad', text: 'Choose a service.' });
    try {
      await save('post', '/center/services', { ...form, price: Number(form.price), durationMins: Number(form.durationMins) });
      setMsg({ tone: 'good', text: `${serviceName(catalog, form.key)} added.` });
      setForm((f) => ({ ...f, key: '', price: '', notes: '' }));
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  return (
    <Layout title="Services & Prices" subtitle="Starting prices before spare parts and GST. Customers see these when they book.">
      {error && <div className="alert bad">{error}</div>}
      {!center ? <p className="muted">Loading…</p> : types.length === 0 ? (
        <div className="empty">Choose the brands you service first. <Link to="/center/profile">Go to Profile & Brands</Link></div>
      ) : (
        <>
          <form className="card" onSubmit={add} noValidate>
            <h3>Add a service</h3>
            <div className="fgrid">
              <label className="field">
                <span>Vehicle type</span>
                <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value, key: '' })}>
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Service</span>
                <select value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })}>
                  <option value="">{available.length ? 'Choose a service' : 'All services already added'}</option>
                  {available.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Starting price (₹)</span><input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="2400" /></label>
              <label className="field"><span>Time needed (min)</span><input type="number" min="15" step="15" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: e.target.value })} /></label>
              <label className="field wide"><span>Note for customers (optional)</span><input maxLength={200} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Labour only; parts extra" /></label>
            </div>
            <div className="row"><button className="btn primary">Add service</button></div>
            <Notice msg={msg} />
          </form>

          <Notice msg={listMsg} />
          {types.map((type) => (
            <div key={type} className="card">
              <h3>{type} services</h3>
              {offered(type).length === 0 ? <p className="empty">No {type.toLowerCase()} services yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Service</th><th className="num">From</th><th className="num">Time</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {offered(type).map((s) => <ServiceRow key={s._id} s={s} catalog={catalog} save={save} onMsg={setListMsg} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </Layout>
  );
}
