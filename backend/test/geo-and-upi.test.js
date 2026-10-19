import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, estimateRoute, hasLocation } from '../src/services/geo.js';
import { upiLink } from '../src/services/payments.js';
import { UPI_ID } from '../src/models/ServiceCenter.js';
import { isValidDateStr } from '../src/utils/slots.js';

test('haversine: same point is 0, Mysuru to Bengaluru is about 125 km', () => {
  const mysuru = { lat: 12.2958, lng: 76.6394 };
  const bengaluru = { lat: 12.9716, lng: 77.5946 };
  assert.equal(haversineKm(mysuru, mysuru), 0);
  const d = haversineKm(mysuru, bengaluru);
  assert.ok(d > 120 && d < 135, `distance ${d}`);
  assert.ok(Math.abs(haversineKm(mysuru, bengaluru) - haversineKm(bengaluru, mysuru)) < 1e-9);
});

test('road estimate is longer than the straight line and flagged as an estimate', () => {
  const r = estimateRoute(10);
  assert.ok(r.distanceKm > 10);
  assert.equal(r.estimated, true);
  assert.ok(r.minutes >= 1);
});

test('hasLocation needs both numbers', () => {
  assert.equal(hasLocation({ location: { lat: 12, lng: 76 } }), true);
  assert.equal(hasLocation({ location: { lat: 12 } }), false);
  assert.equal(hasLocation({}), false);
});

test('UPI ID format', () => {
  for (const ok of ['kaveri.motors@okaxis', 'shop-1@ybl', 'a_b.c@paytm']) assert.ok(UPI_ID.test(ok), ok);
  for (const bad of ['a@b', 'no at sign', 'UPPER@bank', '@okaxis', 'x@@y']) assert.ok(!UPI_ID.test(bad), bad);
});

test('UPI link carries payee, exact amount and invoice number', () => {
  const link = upiLink({ name: 'Kaveri', paymentSettings: { upiId: 'kaveri@okaxis', payeeName: 'Kaveri Motor Works' } }, { total: 2313, invoiceNo: 'KMW-2610-0001' });
  const q = new URL(link).searchParams;
  assert.ok(link.startsWith('upi://pay?'));
  assert.equal(q.get('pa'), 'kaveri@okaxis');
  assert.equal(q.get('am'), '2313.00');
  assert.equal(q.get('cu'), 'INR');
  assert.equal(q.get('tr'), 'KMW-2610-0001');
});

test('date strings are validated', () => {
  assert.equal(isValidDateStr('2026-10-18'), true);
  assert.equal(isValidDateStr('2026-13-40'), false);
  assert.equal(isValidDateStr('18-10-2026'), false);
});
