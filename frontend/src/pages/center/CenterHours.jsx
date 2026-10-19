import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import useCenterProfile from '../../hooks/useCenterProfile.js';
import api, { errorMessage } from '../../api/client.js';
import { fmtDate } from '../../utils/format.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first
const localDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CenterHours() {
  const { center, error, save } = useCenterProfile();
  const [hours, setHours] = useState(null);
  const [slot, setSlot] = useState({ capacityPerSlot: 2, bookingWindowDays: 30 });
  const [holiday, setHoliday] = useState({ date: '', reason: '' });
  const [previewDate, setPreviewDate] = useState(localDate(1));
  const [preview, setPreview] = useState(null);
  const [msgs, setMsgs] = useState({});
  const say = (k, tone, text) => setMsgs((m) => ({ ...m, [k]: { tone, text } }));

  useEffect(() => {
    if (!center) return;
    setHours(center.workingHours.map((d) => ({ ...d })));
    setSlot({ capacityPerSlot: center.slotSettings.capacityPerSlot, bookingWindowDays: center.slotSettings.bookingWindowDays });
  }, [center]);

  const loadPreview = useCallback(async () => {
    try {
      const { data } = await api.get('/center/slots/preview', { params: { date: previewDate } });
      setPreview(data);
    } catch (err) {
      setPreview({ error: errorMessage(err) });
    }
  }, [previewDate]);

  // Refresh the preview whenever the date or saved settings change.
  useEffect(() => { if (center) loadPreview(); }, [center, loadPreview]);

  const setDay = (day, k, v) => setHours((hs) => hs.map((d) => (d.day === day ? { ...d, [k]: v } : d)));

  const saveHours = async () => {
    try {
      await save('put', '/center/hours', { workingHours: hours });
      say('hours', 'good', 'Working hours saved.');
    } catch (err) {
      say('hours', 'bad', errorMessage(err));
    }
  };

  const copyMonday = () => {
    const mon = hours.find((d) => d.day === 1);
    setHours((hs) => hs.map((d) => (d.day >= 2 && d.day <= 6 ? { ...mon, day: d.day } : d)));
  };

  const saveSlot = async (e) => {
    e.preventDefault();
    try {
      await save('put', '/center/slot-settings', { capacityPerSlot: Number(slot.capacityPerSlot), bookingWindowDays: Number(slot.bookingWindowDays) });
      say('slot', 'good', 'Slot settings saved.');
    } catch (err) {
      say('slot', 'bad', errorMessage(err));
    }
  };

  const addHoliday = async (e) => {
    e.preventDefault();
    if (!holiday.date) return say('hol', 'bad', 'Choose a date.');
    try {
      await save('post', '/center/holidays', holiday);
      setHoliday({ date: '', reason: '' });
      say('hol', 'good', 'Holiday added. No bookings will be taken that day.');
    } catch (err) {
      say('hol', 'bad', errorMessage(err));
    }
  };

  const removeHoliday = async (date) => {
    try {
      await save('delete', `/center/holidays/${date}`);
      say('hol', 'good', 'Holiday removed.');
    } catch (err) {
      say('hol', 'bad', errorMessage(err));
    }
  };

  return (
    <Layout title="Hours & Slots" subtitle="Customers book one-hour slots inside your working hours. Each slot takes as many vehicles as you set below.">
      {error && <div className="alert bad">{error}</div>}
      {!hours ? <p className="muted">Loading…</p> : (
        <>
          <div className="card">
            <div className="row between">
              <h3>Working hours</h3>
              <button type="button" className="btn sm" onClick={copyMonday}>Copy Monday to Tue–Sat</button>
            </div>
            <div className="table-wrap">
              <table className="hours">
                <thead><tr><th>Day</th><th>Open</th><th>From</th><th>To</th><th>Break from</th><th>Break to</th></tr></thead>
                <tbody>
                  {ORDER.map((day) => {
                    const d = hours.find((h) => h.day === day);
                    return (
                      <tr key={day} className={d.isOpen ? '' : 'off'}>
                        <td><b>{DAY_NAMES[day]}</b></td>
                        <td><label className="switch"><input type="checkbox" checked={d.isOpen} onChange={(e) => setDay(day, 'isOpen', e.target.checked)} /> {d.isOpen ? 'Open' : 'Closed'}</label></td>
                        <td><input type="time" value={d.open} disabled={!d.isOpen} onChange={(e) => setDay(day, 'open', e.target.value)} aria-label={`${DAY_NAMES[day]} opening time`} /></td>
                        <td><input type="time" value={d.close} disabled={!d.isOpen} onChange={(e) => setDay(day, 'close', e.target.value)} aria-label={`${DAY_NAMES[day]} closing time`} /></td>
                        <td><input type="time" value={d.breakStart} disabled={!d.isOpen} onChange={(e) => setDay(day, 'breakStart', e.target.value)} aria-label={`${DAY_NAMES[day]} break start`} /></td>
                        <td><input type="time" value={d.breakEnd} disabled={!d.isOpen} onChange={(e) => setDay(day, 'breakEnd', e.target.value)} aria-label={`${DAY_NAMES[day]} break end`} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small muted">Leave both break times empty if you don't close for lunch.</p>
            <div className="row"><button className="btn primary" onClick={saveHours}>Save working hours</button></div>
            <Notice msg={msgs.hours} />
          </div>

          <div className="grid2 top">
            <form className="card" onSubmit={saveSlot} noValidate>
              <h3>Slot capacity</h3>
              <label className="field"><span>Vehicles per one-hour slot</span><input type="number" min="1" max="20" value={slot.capacityPerSlot} onChange={(e) => setSlot({ ...slot, capacityPerSlot: e.target.value })} /><small className="muted">Usually the number of service bays or mechanics free at once.</small></label>
              <label className="field"><span>Customers can book up to (days ahead)</span><input type="number" min="1" max="90" value={slot.bookingWindowDays} onChange={(e) => setSlot({ ...slot, bookingWindowDays: e.target.value })} /></label>
              <div className="row"><button className="btn primary">Save slot settings</button></div>
              <Notice msg={msgs.slot} />
            </form>

            <div className="card">
              <h3>Holidays</h3>
              <form className="row align-end" onSubmit={addHoliday} noValidate>
                <label className="field"><span>Date</span><input type="date" min={localDate()} value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} /></label>
                <label className="field grow"><span>Reason (optional)</span><input maxLength={100} value={holiday.reason} onChange={(e) => setHoliday({ ...holiday, reason: e.target.value })} placeholder="Dasara" /></label>
                <button className="btn primary">Add</button>
              </form>
              <Notice msg={msgs.hol} />
              {center.holidays.length === 0 ? <p className="small muted">No holidays planned.</p> : (
                <ul className="plain">
                  {center.holidays.map((h) => (
                    <li key={h.date} className="row between">
                      <span><b>{fmtDate(`${h.date}T00:00:00`)}</b>{h.reason ? ` · ${h.reason}` : ''}</span>
                      <button className="btn sm ghost" onClick={() => removeHoliday(h.date)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="row between align-end">
              <h3>Slot preview</h3>
              <label className="field"><span>Date</span><input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} /></label>
            </div>
            <p className="small muted">This is what customers will be able to book on that date, using your saved settings.</p>
            {preview?.error && <div className="alert bad">{preview.error}</div>}
            {preview && !preview.error && (preview.open ? (
              <div className="slots">
                {preview.slots.map((s) => (
                  <div key={s.start} className="slot"><b>{s.start}–{s.end}</b><small>{s.capacity} vehicle{s.capacity > 1 ? 's' : ''}</small></div>
                ))}
              </div>
            ) : <p className="empty">{preview.reason}. No slots.</p>)}
          </div>
        </>
      )}
    </Layout>
  );
}
