import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout.jsx';
import RevenueView from '../../components/RevenueView.jsx';
import AnalyticsView from '../../components/AnalyticsView.jsx';
import api, { errorMessage } from '../../api/client.js';

const CHIP = { pending: 'warn', verified: 'good', rejected: 'bad', suspended: 'bad' };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [centers, setCenters] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/centers', { params: filter === 'all' ? {} : { status: filter } })
      ]);
      setStats(s.data);
      setCenters(c.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    setBusyId(id);
    try {
      await api.patch(`/admin/centers/${id}/status`, { status });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Layout className="admin-dashboard" title="Platform overview" subtitle="Verify service centers before customers can see them.">
      <div className="stats">
        <div className="stat"><span className="k">Customers</span><span className="v">{stats?.customers ?? '—'}</span></div>
        <div className="stat"><span className="k">Verified centers</span><span className="v">{stats?.verifiedCenters ?? '—'}</span></div>
        <div className="stat"><span className="k">Awaiting verification</span><span className="v">{stats?.pendingCenters ?? '—'}</span></div>
        <div className="stat"><span className="k">Vehicles</span><span className="v">{stats?.vehicles ?? '—'}</span><span className="s">{stats ? `${stats.cars} cars · ${stats.bikes} bikes` : ''}</span></div>
        <div className="stat"><span className="k">Bookings</span><span className="v">{stats?.bookings ?? '—'}</span><span className="s">{stats ? `${stats.bookingsByStatus?.pending || 0} waiting · ${stats.bookingsByStatus?.accepted || 0} confirmed · ${stats.bookingsByStatus?.cancelled || 0} cancelled` : ''}</span></div>
      </div>

      <h2>Analytics</h2>
      <AnalyticsView />

      <h2>Revenue</h2>
      <RevenueView url="/admin/revenue" admin />

      <div className="card">
        <div className="row between">
          <h3>Service centers</h3>
          <div className="seg">
            {['pending', 'verified', 'suspended', 'all'].map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
        </div>
        {error && <div className="alert bad">{error}</div>}
        {loading ? (
          <p className="muted">Loading…</p>
        ) : centers.length === 0 ? (
          <p className="empty">No service centers in this list.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Center</th><th>Owner</th><th>City</th><th>Registered</th><th>Setup</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {centers.map((c) => (
                  <tr key={c._id}>
                    <td><b>{c.name}</b><div className="small muted">{c.address}, {c.pincode}</div></td>
                    <td>{c.owner?.name}<div className="small muted">{c.owner?.email}</div></td>
                    <td>{c.city}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                    <td><span className={`chip ${c.setup?.complete ? 'good' : 'warn'}`}>{c.setup?.complete ? 'Complete' : 'Incomplete'}</span><div className="small muted">{(c.services || []).filter((s) => s.isActive).length} services</div></td>
                    <td><span className={`chip cap ${CHIP[c.verificationStatus]}`}>{c.verificationStatus}</span></td>
                    <td className="row nowrap">
                      {c.verificationStatus !== 'verified' && <button className="btn good sm" disabled={busyId === c._id} onClick={() => setStatus(c._id, 'verified')}>Verify</button>}
                      {c.verificationStatus === 'pending' && <button className="btn bad sm" disabled={busyId === c._id} onClick={() => setStatus(c._id, 'rejected')}>Reject</button>}
                      {c.verificationStatus === 'verified' && <button className="btn bad sm" disabled={busyId === c._id} onClick={() => setStatus(c._id, 'suspended')}>Suspend</button>}
                    </td>
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
