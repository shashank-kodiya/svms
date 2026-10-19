import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import api, { errorMessage } from '../../api/client.js';
import { STATUS, statusLabel, statusTone, inr, niceDate, niceTime } from '../../utils/booking.js';

export default function AdminBookings() {
  const [status, setStatus] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setList(null);
    api.get('/admin/bookings', { params: status ? { status } : {} })
      .then(({ data }) => setList(data))
      .catch((e) => setError(errorMessage(e)));
  }, [status]);

  return (
    <Layout title="All bookings" subtitle="Every booking on the platform, newest first.">
      {error && <div className="alert bad">{error}</div>}
      <div className="card">
        <div className="row between">
          <h3>{list ? `${list.length} booking${list.length === 1 ? '' : 's'}` : 'Bookings'}</h3>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {Object.keys(STATUS).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>
        </div>
        {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="empty">No bookings.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Booking</th><th>When</th><th>Customer</th><th>Center</th><th>Vehicle</th><th>Service</th><th className="num">From</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b._id}>
                    <td className="mono small">{b.bookingNo}</td>
                    <td>{niceDate(b.date)}<div className="small muted">{niceTime(b.slot)}</div></td>
                    <td>{b.customer?.name}<div className="small muted">{b.customer?.email}</div></td>
                    <td>{b.center?.name}<div className="small muted">{b.center?.city}</div></td>
                    <td className="mono small">{b.vehicleSnapshot?.regNumber}</td>
                    <td>{b.service.name}</td>
                    <td className="num">{inr(b.service.price)}</td>
                    <td><span className={`chip ${statusTone(b.status)}`}>{statusLabel(b.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
