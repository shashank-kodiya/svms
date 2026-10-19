import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout.jsx';
import ComplaintThread from '../../components/ComplaintThread.jsx';
import api, { errorMessage } from '../../api/client.js';

const FILTERS = [['open', 'Waiting for center'], ['responded', 'Replied'], ['resolved', 'Resolved'], ['', 'All']];

export default function AdminComplaints() {
  const [status, setStatus] = useState('open');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get('/admin/complaints', { params: status ? { status } : {} }).then(({ data }) => setList(data)).catch((e) => setError(errorMessage(e)));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <Layout title="Complaints" subtitle="Customer complaints about service centers. Step in when a center does not respond.">
      <div className="seg">
        {FILTERS.map(([k, t]) => <button key={k || 'all'} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{t}</button>)}
      </div>
      {error && <div className="alert bad">{error}</div>}
      {list?.length === 0 && <p className="empty">No complaints in this list.</p>}
      <div className="list">
        {list?.map((c) => (
          <ComplaintThread
            key={c._id} c={c} resolveWithNote resolveLabel="Resolve complaint"
            header={<b>{c.bookingNo} · {c.center?.name} <span className="small muted">({c.customer?.name}{c.customer?.phone ? `, ${c.customer.phone}` : ''})</span></b>}
            onSend={async (text) => { await api.post(`/admin/complaints/${c._id}/messages`, { text }); load(); }}
            onResolve={async (note) => { await api.patch(`/admin/complaints/${c._id}/resolve`, { note }); load(); }}
          />
        ))}
      </div>
    </Layout>
  );
}
