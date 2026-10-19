import { useState } from 'react';
import { Stars } from './Stars.jsx';
import api, { errorMessage } from '../api/client.js';

// "Read reviews" for one center, loaded only when the customer opens it.
export default function CenterReviews({ centerId, ratingCount }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const onToggle = (e) => {
    if (!e.target.open || data) return;
    api.get(`/bookings/centers/${centerId}/reviews`).then(({ data: d }) => setData(d)).catch((err) => setError(errorMessage(err)));
  };

  if (!ratingCount) return null;
  return (
    <details onToggle={onToggle}>
      <summary className="small">Read reviews ({ratingCount})</summary>
      {error && <div className="alert bad">{error}</div>}
      {!data && !error && <p className="small muted">Loading…</p>}
      <ul className="plain">
        {data?.reviews.map((r) => (
          <li key={r._id} className="list small">
            <div className="row between"><span><Stars value={r.rating} /> <b>{r.who}</b>{r.serviceName ? <span className="muted"> · {r.serviceName}</span> : null}</span><span className="muted">{new Date(r.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            {r.comment && <div>{r.comment}</div>}
            {r.reply && <div className="muted">Center replied: {r.reply.text}</div>}
          </li>
        ))}
      </ul>
    </details>
  );
}
