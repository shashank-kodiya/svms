import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
const { computeBill, verifyCodeFor, newPickupCode, codesMatch } = await import('../src/services/billing.js');

const job = (extra = {}) => ({
  service: { name: 'General Service', price: 950 },
  recommendations: [],
  partsUsed: [],
  ...extra
});

test('README example: 950 service + 2 x 360 oil + 290 brake shoe = 2,313 with GST', () => {
  const b = computeBill(job({
    partsUsed: [
      { name: 'Scooter engine oil', qty: 2, unitPrice: 360, gstRate: 18, hsn: '2710' },
      { name: 'Front brake shoe', qty: 1, unitPrice: 290, gstRate: 18, hsn: '8714' }
    ]
  }));
  assert.equal(b.taxable, 1960);
  assert.equal(b.cgst, 176.4);
  assert.equal(b.sgst, 176.4);
  assert.equal(b.roundOff, 0.2);
  assert.equal(b.total, 2313);
});

test('CGST + SGST add up to the full GST on every line (no paisa lost on odd amounts)', () => {
  const b = computeBill(job({ service: { name: 'S', price: 333 }, partsUsed: [{ name: 'P', qty: 3, unitPrice: 33.33, gstRate: 5 }] }));
  for (const l of b.lines) {
    const gst = Math.round((l.amount * 100 * l.gstRate) / 100);
    assert.equal(Math.round((l.cgst + l.sgst) * 100), gst);
  }
});

test('only APPROVED repairs are billed; rejected and waiting ones never are', () => {
  const rec = (status, problem) => ({ status, problem, partsCost: 1000, labourCost: 500 });
  const b = computeBill(job({ recommendations: [rec('approved', 'Brake pads'), rec('rejected', 'Battery'), rec('awaiting', 'Wipers')] }));
  const text = b.lines.map((l) => l.description).join('|');
  assert.match(text, /Brake pads/);
  assert.doesNotMatch(text, /Battery|Wipers/);
  assert.equal(b.lines.filter((l) => l.kind === 'repair_parts').length, 1);
  assert.equal(b.lines.filter((l) => l.kind === 'repair_labour').length, 1);
});

test('different GST slabs: 0% adds no tax, 28% is taxed at 28%', () => {
  const b = computeBill(job({ service: { name: 'S', price: 0 }, partsUsed: [{ name: 'Zero', qty: 1, unitPrice: 100, gstRate: 0 }, { name: 'High', qty: 1, unitPrice: 100, gstRate: 28 }] }));
  const zero = b.lines.find((l) => l.description === 'Zero');
  const high = b.lines.find((l) => l.description === 'High');
  assert.equal(zero.cgst + zero.sgst, 0);
  assert.equal(high.cgst + high.sgst, 28);
});

test('total is always a whole rupee and round-off explains the difference', () => {
  const b = computeBill(job({ service: { name: 'S', price: 1234.56 } }));
  assert.equal(b.total, Math.round(b.total));
  assert.ok(Math.abs(b.taxable + b.cgst + b.sgst + b.roundOff - b.total) < 0.005);
  assert.ok(Math.abs(b.roundOff) <= 0.5);
});

test('invoice verify code: same inputs match, any change fails', () => {
  const a = verifyCodeFor('abc', 'KMW-2610-0001', 2313);
  assert.equal(a, verifyCodeFor('abc', 'KMW-2610-0001', 2313));
  assert.notEqual(a, verifyCodeFor('abc', 'KMW-2610-0001', 2314));
  assert.notEqual(a, verifyCodeFor('abc', 'KMW-2610-0002', 2313));
  assert.equal(a.length, 16);
});

test('pickup code is 4 digits and compared exactly', () => {
  for (let i = 0; i < 200; i += 1) assert.match(newPickupCode(), /^\d{4}$/);
  assert.equal(codesMatch('0042', '0042'), true);
  assert.equal(codesMatch('0042', '0043'), false);
  assert.equal(codesMatch('42', '0042'), false);
  assert.equal(codesMatch(undefined, '0042'), false);
});
