import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceStatus, buildSuggestions, kmPerDay, daysBetween } from '../src/services/maintenance.js';

const today = '2026-10-18';

test('daysBetween counts calendar days', () => {
  assert.equal(daysBetween('2026-10-18', '2026-10-25'), 7);
  assert.equal(daysBetween('2026-10-18', '2026-10-17'), -1);
});

test('no last service means no service status', () => {
  assert.equal(serviceStatus({ km: 100 }, today), null);
});

test('service is OK well within 6 months and 10,000 km', () => {
  const s = serviceStatus({ km: 22000, lastService: { date: '2026-09-01', km: 21000 } }, today);
  assert.equal(s.state, 'ok');
});

test('overdue by date (past 6 months) even if km is fine', () => {
  const s = serviceStatus({ km: 21500, lastService: { date: '2026-03-01', km: 21000 } }, today);
  assert.equal(s.state, 'overdue');
  assert.ok(s.daysLeft < 0);
});

test('overdue by km (10,000 km passed) even if the date is fine', () => {
  const s = serviceStatus({ km: 31500, lastService: { date: '2026-09-01', km: 21000 } }, today);
  assert.equal(s.state, 'overdue');
  assert.ok(s.kmLeft <= 0);
});

test('"due soon" within 500 km of the limit', () => {
  const s = serviceStatus({ km: 30700, lastService: { date: '2026-09-01', km: 21000 } }, today);   // 300 km left
  assert.equal(s.state, 'soon');
  // exactly at the limit counts as overdue
  assert.equal(serviceStatus({ km: 31000, lastService: { date: '2026-09-01', km: 21000 } }, today).state, 'overdue');
});

test('km per day needs two readings at least a week apart', () => {
  assert.equal(kmPerDay({ odometer: [{ km: 100, date: '2026-10-01' }] }), null);
  assert.equal(kmPerDay({ odometer: [{ km: 100, date: '2026-10-01' }, { km: 130, date: '2026-10-03' }] }), null);
  assert.equal(Math.round(kmPerDay({ odometer: [{ km: 1000, date: '2026-10-01' }, { km: 1300, date: '2026-10-11' }] })), 30);
});

test('suggestions: critical brakes rank above everything and replaced parts are not suggested', () => {
  const v = { km: 100, lastService: { date: '2026-09-01', km: 50 } };
  const health = { date: '2026-09-01', items: { engine: 'good', brakes: 'critical', tyres: 'needs_attention', battery: 'replaced', engineOil: 'changed' } };
  const out = buildSuggestions(v, health, today);
  assert.equal(out[0].severity, 'high');
  assert.match(out[0].title, /Brakes/);
  assert.equal(out.length, 2);
  assert.ok(!out.some((s) => /Battery|oil/i.test(s.title)));
});
