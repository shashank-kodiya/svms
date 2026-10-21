import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import ComplaintThread from '../../components/ComplaintThread.jsx';
import { Stars } from '../../components/Stars.jsx';
import api, { errorMessage } from '../../api/client.js';
import './CenterFeedback.css';

function ReviewRow({ r, onSaved }) {
  const [text, setText] = useState(r.reply?.text || '');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    setMsg(null);
    try { await api.patch(`/center/reviews/${r._id}/reply`, { text }); setEditing(false); onSaved(); } catch (err) { setMsg({ tone: 'bad', text: errorMessage(err) }); }
  };
  return (
    <div className="card inner">
      <div className="row between"><span><Stars value={r.rating} /> <b>{r.customer?.name}</b> <span className="small muted">· {r.serviceName}</span></span><span className="small muted">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
      {r.comment ? <p>{r.comment}</p> : <p className="small muted">No comment.</p>}
      {r.reply?.text && !editing ? (
        <div className="bubble service_center"><span className="small muted">Your reply</span><span>{r.reply.text}</span><button className="btn ghost sm" onClick={() => setEditing(true)}>Edit reply</button></div>
      ) : (
        <div className="row align-end">
          <label className="field grow"><span>Reply to this review</span><input maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank you for visiting us…" /></label>
          <button className="btn sm primary" disabled={text.trim().length < 2} onClick={save}>Send reply</button>
        </div>
      )}
      <Notice msg={msg} />
    </div>
  );
}

export default function CenterFeedback() {
  const [tab, setTab] = useState('complaints');
  const [reviews, setReviews] = useState(null);
  const [complaints, setComplaints] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/center/reviews').then(({ data }) => setReviews(data)).catch((e) => setError(errorMessage(e)));
    api.get('/center/complaints').then(({ data }) => setComplaints(data)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCount = (complaints || []).filter((c) => c.isOpen).length;
  return (
    <Layout title="Reviews & complaints" subtitle="What customers say about your center. Reply quickly: it builds trust.">
      <div className="center-feedback">
      {error && <div className="alert bad">{error}</div>}
      <div className="stats">
        <div className="stat center-feedback__stat"><span className="k">Average rating</span><span className="v">{reviews ? (reviews.ratingCount ? reviews.ratingAvg.toFixed(1) : '—') : '…'}</span><span className="s">{reviews ? `${reviews.ratingCount} review${reviews.ratingCount === 1 ? '' : 's'}` : ''}</span></div>
        <div className="stat center-feedback__stat"><span className="k">Open complaints</span><span className="v">{complaints ? openCount : '…'}</span><span className="s">Respond within a day</span></div>
      </div>
      <div className="seg">
        {[['complaints', `Complaints${openCount ? ` (${openCount})` : ''}`], ['reviews', 'Reviews']].map(([k, t]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}
      </div>

      {tab === 'complaints' && (
        <div className="list">
          {complaints?.length === 0 && <p className="empty">No complaints. Well done.</p>}
          {complaints?.map((c) => (
            <ComplaintThread key={c._id} c={c} header={<b>{c.bookingNo} · {c.customer?.name}{c.customer?.phone ? ` · ${c.customer.phone}` : ''}</b>}
              onSend={async (text) => { await api.post(`/center/complaints/${c._id}/messages`, { text }); load(); }} />
          ))}
        </div>
      )}
      {tab === 'reviews' && (
        <div className="list">
          {reviews?.reviews.length === 0 && <p className="empty">No reviews yet. They appear after customers collect their vehicles.</p>}
          {reviews?.reviews.map((r) => <ReviewRow key={r._id} r={r} onSaved={load} />)}
        </div>
      )}
      </div>
    </Layout>
  );
}
