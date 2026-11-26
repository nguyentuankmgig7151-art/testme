import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentStatus } from './shipment.mjs';

test('在五分钟整收到的回执仍计入已发货', () => {
  assert.equal(shipmentStatus([{ id: 'E-106', at: 1_000 }], 301_000).status, '已发货');
});

test('超过五分钟的回执不计入本轮看板', () => {
  assert.equal(shipmentStatus([{ id: 'E-107', at: 1_000 }], 301_001).status, '待发货');
});
