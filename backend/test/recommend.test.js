import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAll, smoothedRating, WEIGHTS } from '../src/services/recommend.js';

const base = { price: 1000, distanceKm: 5, freeSlots: 4, totalSlots: 8, completedJobs: 10, ratingAvg: 4.5, ratingCount: 20 };

test('weights add up to 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('scores stay between 0 and 100, with and without distance', () => {
  const entries = [base, { ...base, price: 5000, distanceKm: 40, freeSlots: 0, completedJobs: 0, ratingAvg: 1, ratingCount: 50 }];
  for (const set of [entries, entries.map((e) => ({ ...e, distanceKm: null }))]) {
    for (const r of scoreAll(set)) assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score}`);
  }
});

test('a perfect center without a location scores 100', () => {
  const [r] = scoreAll([{ price: 800, distanceKm: null, freeSlots: 8, totalSlots: 8, completedJobs: 50, ratingAvg: 5, ratingCount: 1000 }]);
  assert.ok(r.score >= 99, `score ${r.score}`);
});

test('closer beats farther, all else equal', () => {
  const [near, far] = scoreAll([{ ...base, distanceKm: 1 }, { ...base, distanceKm: 20 }]);
  assert.ok(near.score > far.score);
});

test('cheaper beats dearer, all else equal', () => {
  const [cheap, dear] = scoreAll([{ ...base, price: 800 }, { ...base, price: 1600 }]);
  assert.ok(cheap.score > dear.score);
  assert.ok(cheap.reasons.includes('Lowest price'));
});

test('more free slots beats fewer; a fully booked center is flagged', () => {
  const [open, full] = scoreAll([{ ...base, freeSlots: 8 }, { ...base, freeSlots: 0 }]);
  assert.ok(open.score > full.score);
  assert.ok(full.reasons.includes('No free slots on this date'));
});

test('one 5-star review does not beat 100 reviews at 4.8 (smoothing)', () => {
  assert.ok(smoothedRating(5, 1) < smoothedRating(4.8, 100));
  const [newbie, veteran] = scoreAll([{ ...base, ratingAvg: 5, ratingCount: 1 }, { ...base, ratingAvg: 4.8, ratingCount: 100 }]);
  assert.ok(veteran.score >= newbie.score);
});

test('a center with no reviews is treated as average-good, not as zero', () => {
  assert.equal(smoothedRating(0, 0), 4);
  const [unrated, bad] = scoreAll([{ ...base, ratingAvg: 0, ratingCount: 0 }, { ...base, ratingAvg: 1.5, ratingCount: 30 }]);
  assert.ok(unrated.score > bad.score);
});
