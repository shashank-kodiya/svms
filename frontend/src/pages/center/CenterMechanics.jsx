import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import api, { errorMessage } from '../../api/client.js';

const SKILLS = ['Engine', 'Brakes', 'Electrical', 'AC', 'Tyres', 'Suspension', 'Body work', 'Two-wheeler'];
const blank = { name: '', phone: '', experienceYears: '', skills: [] };

function MechanicForm({ initial, onSubmit, submitLabel, onCancel }) {
  const [f, setF] = useState(initial);
  const toggle = (s) => setF((x) => ({ ...x, skills: x.skills.includes(s) ? x.skills.filter((k) => k !== s) : [...x.skills, s] }));
  return (
    <form className="list" onSubmit={(e) => { e.preventDefault(); onSubmit(f, () => setF(blank)); }} noValidate>
      <div className="fgrid">
        <label className="field"><span>Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field"><span>Mobile (optional)</span><input inputMode="numeric" maxLength={10} value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="field"><span>Experience (years)</span><input type="number" min="0" max="50" value={f.experienceYears ?? ''} onChange={(e) => setF({ ...f, experienceYears: e.target.value })} /></label>
      </div>
      <div className="checks">
        {SKILLS.map((s) => (
          <label key={s} className={`check ${f.skills.includes(s) ? 'on' : ''}`}><input type="checkbox" checked={f.skills.includes(s)} onChange={() => toggle(s)} />{s}</label>
        ))}
      </div>
      <div className="row">
        <button className="btn primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function CenterMechanics() {
  const [list, setList] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [listMsg, setListMsg] = useState(null);

  const load = useCallback(() =>
    api.get('/center/mechanics', { params: showAll ? { all: 'true' } : {} })
      .then(({ data }) => setList(data))
      .catch((e) => setListMsg({ tone: 'bad', text: errorMessage(e) })), [showAll]);
  useEffect(() => { load(); }, [load]);

  const clean = (f) => ({ name: f.name, phone: f.phone || '', skills: f.skills, ...(f.experienceYears !== '' && f.experienceYears != null ? { experienceYears: Number(f.experienceYears) } : {}) });

  const add = async (f, reset) => {
    setMsg(null);
    try {
      await api.post('/center/mechanics', clean(f));
      reset();
      await load();
      setMsg({ tone: 'good', text: `${f.name} added.` });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  const update = async (id, body, text) => {
    setListMsg(null);
    try {
      await api.patch(`/center/mechanics/${id}`, body);
      setEditing(null);
      await load();
      setListMsg({ tone: 'good', text });
    } catch (err) {
      setListMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  return (
    <Layout title="Mechanics" subtitle="Mechanics don't need a login. You assign them to jobs from the job card (Phase 5).">
      <div className="card">
        <h3>Add a mechanic</h3>
        <MechanicForm initial={blank} onSubmit={add} submitLabel="Add mechanic" />
        <Notice msg={msg} />
      </div>

      <div className="card">
        <div className="row between">
          <h3>Your team</h3>
          <label className="switch"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show inactive</label>
        </div>
        <Notice msg={listMsg} />
        {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="empty">No mechanics yet.</p> : (
          <div className="list">
            {list.map((m) => (
              <div key={m._id} className={`item ${m.isActive ? '' : 'off'}`}>
                {editing === m._id ? (
                  <MechanicForm
                    initial={{ name: m.name, phone: m.phone || '', experienceYears: m.experienceYears ?? '', skills: m.skills || [] }}
                    submitLabel="Save"
                    onCancel={() => setEditing(null)}
                    onSubmit={(f) => update(m._id, clean(f), 'Mechanic updated.')}
                  />
                ) : (
                  <div className="row between">
                    <div>
                      <b>{m.name}</b> {!m.isActive && <span className="chip">Inactive</span>}
                      <div className="small muted">{[m.phone, m.experienceYears != null ? `${m.experienceYears} yrs experience` : null].filter(Boolean).join(' · ') || 'No contact added'}</div>
                      <div className="row chips">{(m.skills || []).map((s) => <span key={s} className="chip">{s}</span>)}</div>
                    </div>
                    <div className="row nowrap">
                      <button className="btn sm" onClick={() => setEditing(m._id)}>Edit</button>
                      <button className="btn sm" onClick={() => update(m._id, { isActive: !m.isActive }, m.isActive ? `${m.name} marked inactive.` : `${m.name} is active again.`)}>{m.isActive ? 'Mark inactive' : 'Make active'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
