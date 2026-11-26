import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentStatus } from './shipment.mjs';

test('同一出库事件补发时只计一次', () => {
  const events = [{ id: 'E-104', at: 1_000 }, { id: 'E-104', at: 1_000 }];
  assert.deepEqual(shipmentStatus(events, 2_000), { status: '已发货', count: 1 });
});

test('未来回执不改变当前状态', () => {
  assert.equal(shipmentStatus([{ id: 'E-105', at: 3_000 }], 2_000).status, '待发货');
});
