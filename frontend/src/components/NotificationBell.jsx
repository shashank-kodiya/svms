import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { getSocket } from '../api/socket.js';

// Bell in the top bar: unread count, and a short pop-up when something new arrives while you are online.
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api.get('/notifications', { params: { unread: true } }).then(({ data }) => alive && setUnread(data.unread)).catch(() => {});
    const socket = getSocket();
    let timer;
    const onNew = (n) => {
      setUnread((c) => c + 1);
      setToast(n);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 7000);
    };
    socket.on('notification:new', onNew);
    return () => { alive = false; clearTimeout(timer); socket.off('notification:new', onNew); };
  }, []);

  // The notifications page tells us when it changes the count.
  useEffect(() => {
    const onCount = (e) => setUnread(e.detail);
    window.addEventListener('svms:unread', onCount);
    return () => window.removeEventListener('svms:unread', onCount);
  }, []);

  return (
    <>
      <Link to="/notifications" className="bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </Link>
      {toast && (
        <div className="toast" role="status" onClick={() => { setToast(null); navigate(toast.link || '/notifications'); }}>
          <b>{toast.title}</b>
          {toast.body && <span className="small">{toast.body}</span>}
        </div>
      )}
    </>
  );
}
