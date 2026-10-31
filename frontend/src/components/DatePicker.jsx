import { useEffect, useMemo, useRef, useState } from 'react';
import { localDate } from '../utils/booking.js';

// Our own date picker (the browser's calendar pop-up can't be styled): a rounded card with month
// navigation, quick "Today / Tomorrow" chips and keyboard support. Works with 'YYYY-MM-DD' strings.
const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (s) => new Date(`${s}T00:00:00`);
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return toStr(d); };
const pretty = (s) => toDate(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function DatePicker({ value, onChange, min, max, label = 'Date' }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value || localDate()).slice(0, 7)); // 'YYYY-MM' shown
  const [focus, setFocus] = useState(value || localDate());
  const box = useRef(null);
  const grid = useRef(null);
  const today = localDate();

  const allowed = (s) => (!min || s >= min) && (!max || s <= max);

  // The 6 weeks shown for the current month (starting on Sunday).
  const days = useMemo(() => {
    const first = toDate(`${view}-01`);
    const start = addDays(toStr(first), -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view]);

  const monthTitle = toDate(`${view}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const shiftMonth = (n) => {
    const d = toDate(`${view}-01`);
    d.setMonth(d.getMonth() + n);
    setView(toStr(d).slice(0, 7));
  };
  const canPrev = !min || `${view}-01` > min;
  const canNext = !max || addDays(toStr(new Date(toDate(`${view}-01`).getFullYear(), toDate(`${view}-01`).getMonth() + 1, 0)), 0) < max;

  const pick = (s) => {
    if (!allowed(s)) return;
    onChange(s);
    setOpen(false);
  };

  // Open on the selected month; close on outside click or Esc.
  useEffect(() => {
    if (!open) return undefined;
    setView((value || today).slice(0, 7));
    setFocus(value || today);
    const onDoc = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep keyboard focus on the focused day.
  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector(`[data-day="${focus}"]`)?.focus();
  }, [open, focus, view]);

  const onKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[e.key] != null) {
      e.preventDefault();
      const next = addDays(focus, moves[e.key]);
      setFocus(next);
      if (next.slice(0, 7) !== view) setView(next.slice(0, 7));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      shiftMonth(e.key === 'PageUp' ? -1 : 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(focus);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const quick = [['Today', today], ['Tomorrow', addDays(today, 1)]].filter(([, s]) => allowed(s));

  return (
    <div className="datepicker" ref={box}>
      <button type="button" className={`datepicker__field ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value ? pretty(value) : 'choose a date'}`}>
        <span>{value ? pretty(value) : 'Choose a date'}</span>
        <span className="datepicker__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10ZM7 12h5v5H7v-5Z" /></svg>
        </span>
      </button>

      {open && (
        <div className="datepicker__pop" role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
          <div className="datepicker__head">
            <button type="button" className="datepicker__nav" onClick={() => shiftMonth(-1)} disabled={!canPrev} aria-label="Previous month">‹</button>
            <b>{monthTitle}</b>
            <button type="button" className="datepicker__nav" onClick={() => shiftMonth(1)} disabled={!canNext} aria-label="Next month">›</button>
          </div>
          <div className="datepicker__week" aria-hidden="true">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="datepicker__grid" role="grid" ref={grid} onKeyDown={onKey}>
            {days.map((s) => {
              const ok = allowed(s);
              const cls = [
                'datepicker__day',
                s.slice(0, 7) !== view && 'other',
                s === today && 'today',
                s === value && 'selected',
                !ok && 'disabled'
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={s} type="button" role="gridcell" className={cls} data-day={s}
                  tabIndex={s === focus ? 0 : -1} disabled={!ok} aria-selected={s === value}
                  aria-label={`${pretty(s)}${s === today ? ', today' : ''}${!ok ? ', not available' : ''}`}
                  onClick={() => pick(s)}
                >
                  {Number(s.slice(8))}
                </button>
              );
            })}
          </div>
          {quick.length > 0 && (
            <div className="datepicker__foot">
              {quick.map(([t, s]) => <button key={t} type="button" className={`datepicker__chip ${s === value ? 'on' : ''}`} onClick={() => pick(s)}>{t}</button>)}
              {max && <span className="datepicker__hint">Up to {pretty(max).replace(/^\w+, /, '')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
