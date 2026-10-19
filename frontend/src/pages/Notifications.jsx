import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Notice from '../components/Notice.jsx';
import api, { errorMessage } from '../api/client.js';
import { getSocket } from '../api/socket.js';

const TYPE_TONE = { booking: 'info', bill: 'warn', payment: 'good', reminder: 'warn', system: 'info' };
const setBell = (n) => window.dispatchEvent(new CustomEvent('svms:unread', { detail: n }));

const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    api.get('/notifications').then(({ data }) => { setItems(data.items); setUnread(data.unread); setBell(data.unread); }).catch((e) => setMsg({ tone: 'bad', text: errorMessage(e) }));
  }, []);

  useEffect(() => {
    load();
    api.get('/notifications/preferences').then(({ data }) => setPrefs(data)).catch(() => {});
    const socket = getSocket();
    socket.on('notification:new', load);
    return () => socket.off('notification:new', load);
  }, [load]);

  const open = async (n) => {
    if (!n.readAt) {
      try { const { data } = await api.patch(`/notifications/${n._id}/read`); setUnread(data.unread); setBell(data.unread); } catch { /* opening the page matters more */ }
    }
    if (n.link) navigate(n.link);
    else load();
  };

  const readAll = async () => {
    try { await api.patch('/notifications/read-all'); load(); } catch (e) { setMsg({ tone: 'bad', text: errorMessage(e) }); }
  };

  const toggleEmail = async (on) => {
    setMsg(null);
    try {
      await api.put('/notifications/preferences', { emailNotifications: on });
      setPrefs((p) => ({ ...p, emailNotifications: on }));
      setMsg({ tone: 'good', text: on ? 'Email updates are on.' : 'Email updates are off. You will still see notifications here.' });
    } catch (e) {
      setMsg({ tone: 'bad', text: errorMessage(e) });
    }
  };

  return (
    <Layout title="Notifications" subtitle="Updates about your bookings, bills, payments and reminders.">
      <div className="card">
        <div className="row between">
          <h3>Email</h3>
          {prefs && (
            <label className="row"><input type="checkbox" checked={prefs.emailNotifications} onChange={(e) => toggleEmail(e.target.checked)} /> <span>Email me important updates</span></label>
          )}
        </div>
        {prefs && <p className="small muted">{prefs.emailConfigured ? `Emails go to ${prefs.email}.` : 'Email sending is not set up on this server yet, so updates appear here only.'}</p>}
        <Notice msg={msg} />
      </div>

      <div className="card">
        <div className="row between">
          <h3>Inbox {unread > 0 && <span className="chip warn">{unread} new</span>}</h3>
          <button className="btn sm" onClick={readAll} disabled={!unread}>Mark all as read</button>
        </div>
        {items === null ? <p className="muted">Loading…</p> : items.length === 0 ? (
          <p className="empty">Nothing yet. Updates about your bookings will show up here.</p>
        ) : (
          <ul className="plain notes">
            {items.map((n) => (
              <li key={n._id}>
                <button type="button" className={`note ${n.readAt ? '' : 'unread'}`} onClick={() => open(n)}>
                  <span className="row between">
                    <b>{n.title}</b>
                    <span className="row"><span className={`chip ${TYPE_TONE[n.type] || 'info'}`}>{n.type}</span><span className="small muted">{when(n.createdAt)}</span></span>
                  </span>
                  {n.body && <span className="small">{n.body}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
