import test from 'node:test';
import assert from 'node:assert/strict';
import { docStep } from '../src/services/reminders.js';

test('document reminders fire at 30, 7, 1 and 0 days, then "expired" for a month', () => {
  assert.equal(docStep(45), null);
  assert.equal(docStep(31), null);
  assert.equal(docStep(30), 30);
  assert.equal(docStep(15), 30);
  assert.equal(docStep(8), 30);
  assert.equal(docStep(7), 7);
  assert.equal(docStep(2), 7);
  assert.equal(docStep(1), 1);
  assert.equal(docStep(0), 0);
  assert.equal(docStep(-1), 'expired');
  assert.equal(docStep(-30), 'expired');
  assert.equal(docStep(-31), null);
});
