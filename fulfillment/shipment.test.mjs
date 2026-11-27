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

test('同门店重复的回执事件只计一次', () => {
  const events = [
    { storeId: 'S01', id: 'E-101', at: 1_000 },
    { storeId: 'S01', id: 'E-101', at: 1_200 },
  ];
  assert.deepEqual(shipmentStatus(events, 301_000), { status: '已发货', count: 1 });
});

test('不同门店的同一回执事件各计一次，窗口外的回执不计入', () => {
  const events = [
    { storeId: 'S01', id: 'E-101', at: 1_000 },
    { storeId: 'S01', id: 'E-101', at: 1_200 },
    { storeId: 'S02', id: 'E-101', at: 1_000 },
    { storeId: 'S03', id: 'E-102', at: 999 },
    { storeId: 'S03', id: 'E-103', at: 301_001 },
  ];
  assert.deepEqual(shipmentStatus(events, 301_000), { status: '已发货', count: 2 });
});

test('取消订单不计入跨店回执', () => {
  assert.deepEqual(shipmentStatus([{ storeId: 'S01', id: 'E-205', at: 1000, cancelled: true }], 2000), { status: '待发货', count: 0 });
});
