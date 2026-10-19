import { useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import api, { errorMessage } from '../../api/client.js';
import { inr, GST_RATES } from '../../utils/booking.js';

const blank = { name: '', partNo: '', hsn: '', unitPrice: '', gstRate: 18, stock: '', lowStockAt: 3 };
const num = (v) => (v === '' || v == null ? undefined : Number(v));

function PartRow({ p, onSaved, onError }) {
  const [edit, setEdit] = useState(null);
  const [recv, setRecv] = useState('');
  const low = p.stock <= p.lowStockAt;

  const patch = async (body, text) => {
    try {
      const { data } = await api.patch(`/center/parts/${p._id}`, body);
      onSaved(data, text);
      return true;
    } catch (err) {
      onError(errorMessage(err));
      return false;
    }
  };

  if (edit) {
    return (
      <tr>
        <td><input aria-label="Part name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></td>
        <td><input aria-label="Part number" value={edit.partNo} onChange={(e) => setEdit({ ...edit, partNo: e.target.value })} size={10} /></td>
        <td><input aria-label="HSN" value={edit.hsn} onChange={(e) => setEdit({ ...edit, hsn: e.target.value })} size={6} /></td>
        <td className="num"><input aria-label="Price" type="number" min="0" value={edit.unitPrice} onChange={(e) => setEdit({ ...edit, unitPrice: e.target.value })} style={{ width: 90 }} /></td>
        <td className="num"><select aria-label="GST" value={edit.gstRate} onChange={(e) => setEdit({ ...edit, gstRate: Number(e.target.value) })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></td>
        <td className="num">{p.stock}</td>
        <td className="num"><input aria-label="Low stock level" type="number" min="0" value={edit.lowStockAt} onChange={(e) => setEdit({ ...edit, lowStockAt: e.target.value })} style={{ width: 60 }} /></td>
        <td>
          <div className="row">
            <button className="btn primary sm" onClick={async () => { if (await patch({ ...edit, unitPrice: num(edit.unitPrice), lowStockAt: num(edit.lowStockAt) }, `${edit.name} updated.`)) setEdit(null); }}>Save</button>
            <button className="btn sm" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td><b>{p.name}</b></td>
      <td className="mono small">{p.partNo || '—'}</td>
      <td className="small">{p.hsn || '—'}</td>
      <td className="num">{inr(p.unitPrice)}</td>
      <td className="num">{p.gstRate}%</td>
      <td className="num">{low ? <span className="stock-low" title="At or below the low-stock level">{p.stock} · low</span> : p.stock}</td>
      <td className="num small muted">{p.lowStockAt}</td>
      <td>
        <div className="row">
          <input aria-label={`Received quantity of ${p.name}`} type="number" min="1" placeholder="Qty" value={recv} onChange={(e) => setRecv(e.target.value)} style={{ width: 64 }} />
          <button className="btn sm" onClick={async () => { if (await patch({ addStock: Number(recv) }, `${recv} × ${p.name} added to stock.`)) setRecv(''); }}>Receive</button>
          <button className="btn ghost sm" onClick={() => setEdit({ name: p.name, partNo: p.partNo || '', hsn: p.hsn || '', unitPrice: p.unitPrice, gstRate: p.gstRate, lowStockAt: p.lowStockAt })}>Edit</button>
        </div>
      </td>
    </tr>
  );
}

export default function CenterParts() {
  const [parts, setParts] = useState(null);
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState(null);
  const [addMsg, setAddMsg] = useState(null);
  const [q, setQ] = useState('');

  const load = () => api.get('/center/parts').then(({ data }) => setParts(data)).catch((e) => setMsg({ tone: 'bad', text: errorMessage(e) }));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setAddMsg(null);
    try {
      const { data } = await api.post('/center/parts', { ...form, unitPrice: num(form.unitPrice), stock: num(form.stock) ?? 0, lowStockAt: num(form.lowStockAt) });
      setParts((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(blank);
      setAddMsg({ tone: 'good', text: `${data.name} added.` });
    } catch (err) {
      setAddMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  const remove = async (p) => {
    try {
      await api.delete(`/center/parts/${p._id}`);
      setParts((list) => list.filter((x) => x._id !== p._id));
      setMsg({ tone: 'good', text: `${p.name} removed. Old bills that used it are not changed.` });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const shown = (parts || []).filter((p) => !q || `${p.name} ${p.partNo}`.toLowerCase().includes(q.toLowerCase()));
  const lowCount = (parts || []).filter((p) => p.stock <= p.lowStockAt).length;

  return (
    <Layout title="Spare Parts" subtitle="Parts in stock. Using a part on a job takes it out of stock and adds it to the bill.">
      {lowCount > 0 && <div className="alert warn"><span><b>{lowCount} part{lowCount > 1 ? 's are' : ' is'} low on stock.</b> Use “Receive” when new stock arrives.</span></div>}
      <div className="card">
        <div className="row between">
          <h3>In stock ({parts?.length ?? '…'})</h3>
          <label className="field"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or part no." /></label>
        </div>
        <Notice msg={msg} />
        {parts === null ? <p className="muted">Loading…</p> : parts.length === 0 ? <p className="empty">No parts yet. Add your first part below.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Part</th><th>Part no.</th><th>HSN</th><th className="num">Price</th><th className="num">GST</th><th className="num">Stock</th><th className="num">Warn at</th><th>Actions</th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <PartRow
                    key={p._id}
                    p={p}
                    onSaved={(data, text) => { setParts((list) => list.map((x) => (x._id === data._id ? data : x))); setMsg({ tone: 'good', text }); }}
                    onError={(text) => setMsg({ tone: 'bad', text })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {parts?.length > 0 && (
          <details>
            <summary className="small">Remove a part</summary>
            <div className="row">{parts.map((p) => <button key={p._id} className="btn ghost sm" onClick={() => remove(p)}>Remove {p.name}</button>)}</div>
          </details>
        )}
      </div>

      <form className="card" onSubmit={add} noValidate>
        <h3>Add a part</h3>
        <div className="fgrid">
          <label className="field"><span>Part name</span><input maxLength={80} value={form.name} onChange={set('name')} placeholder="Brake fluid DOT 4 (500 ml)" /></label>
          <label className="field"><span>Part no. (optional)</span><input maxLength={40} value={form.partNo} onChange={set('partNo')} placeholder="BF-DOT4-500" /></label>
          <label className="field"><span>HSN code (optional)</span><input inputMode="numeric" maxLength={8} value={form.hsn} onChange={set('hsn')} placeholder="3819" /></label>
          <label className="field"><span>Price per unit ₹ (before GST)</span><input type="number" min="0" value={form.unitPrice} onChange={set('unitPrice')} placeholder="290" /></label>
          <label className="field"><span>GST</span><select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></label>
          <label className="field"><span>Quantity in stock</span><input type="number" min="0" value={form.stock} onChange={set('stock')} placeholder="10" /></label>
          <label className="field"><span>Warn when stock is at</span><input type="number" min="0" value={form.lowStockAt} onChange={set('lowStockAt')} /></label>
        </div>
        <div className="row"><button className="btn primary">Add part</button></div>
        <Notice msg={addMsg} />
      </form>
    </Layout>
  );
}
