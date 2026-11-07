import test from 'node:test';
import assert from 'node:assert/strict';
import rels from '../lib/fn/rels.js';

test('RELS: returns corporate capital structure and related securities for AAPL', async () => {
  const data = await rels({ symbol: 'AAPL' });
  assert.equal(data.symbol, 'AAPL');
  assert.ok(data.equities.length >= 1, 'Should have equity classes');
  assert.ok(data.equities.some(e => e.ticker.includes('AAPL')), 'Should have common stock');
  assert.ok(data.debt.length >= 1, 'Should map related debt issues from bond universe');
  assert.ok(data.debt.some(d => d.cusip === '037833EK3' || d.name.includes('Apple')), 'Should include Apple corporate bond');
  assert.ok(data.peers.length >= 1, 'Should include sector peers / competitors');
});

test('RELS: handles dual-class capital structure for GOOGL / Alphabet', async () => {
  const data = await rels({ symbol: 'GOOGL' });
  assert.equal(data.symbol, 'GOOGL');
  assert.ok(data.equities.some(e => e.type.includes('Class A')), 'Should include Class A');
  assert.ok(data.equities.some(e => e.type.includes('Class C')), 'Should include Class C');
});

test('RELS: handles foreign cross-listing and ADRs for BABA', async () => {
  const data = await rels({ symbol: 'BABA' });
  assert.ok(data.equities.some(e => e.exchange === 'HKEX' || e.ticker.includes('9988')), 'Should include 9988 HK listing');
  assert.ok(data.equities.some(e => e.type.includes('Depository Receipt')), 'Should include ADR');
});

test('RELS: fallback returns default structure for unknown ticker without crashing', async () => {
  const data = await rels({ symbol: 'UNKNOWNXYZ' });
  assert.equal(data.symbol, 'UNKNOWNXYZ');
  assert.ok(data.equities.length >= 1);
  assert.equal(data.debt.length, 0);
});
