import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentStatus } from './shipment.mjs';
import { buildStoreDailyReport } from './daily-report.mjs';

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

// FJ-57（Issue #10）：门店 S02 自提单的日报核销口径
const S02_DAILY_ORDERS = [
  { id: 'O-401', storeId: 'S02', deliveryMethod: 'pickup', status: '已核销' },
  { id: 'O-402', storeId: 'S02', deliveryMethod: 'pickup', status: '未核销' },
  { id: 'O-403', storeId: 'S01', deliveryMethod: 'pickup', status: '已核销' },
  { id: 'O-404', storeId: 'S02', deliveryMethod: 'delivery', status: '已发货' },
];
const S02_DAILY_EVENTS = [{ storeId: 'S02', id: 'E-401', at: 1_000 }];
const S02_OBSERVED_AT = 301_000;

function reportS02(orders = S02_DAILY_ORDERS, shipmentEvents = S02_DAILY_EVENTS) {
  return buildStoreDailyReport({ storeId: 'S02', orders, shipmentEvents, observedAt: S02_OBSERVED_AT });
}

test('FJ-57 已核销自提单 O-401 在 S02 日报显示已提货并只计一次', () => {
  const report = reportS02();
  const row = report.rows.find(({ orderId }) => orderId === 'O-401');
  assert.equal(row.reportStatus, '已提货');
  assert.equal(report.metrics.pickedUp, 1);
});

test('FJ-57 对照样本 O-402 未核销时仍显示待提货', () => {
  const report = reportS02();
  const row = report.rows.find(({ orderId }) => orderId === 'O-402');
  assert.equal(row.reportStatus, '待提货');
});

test('FJ-57 只有未核销自提单时已提货计数为 0', () => {
  const report = reportS02([{ id: 'O-402', storeId: 'S02', deliveryMethod: 'pickup', status: '未核销' }], []);
  assert.equal(report.metrics.pickedUp, 0);
});

test('FJ-57 同一订单的重复核销记录只占一行且不重复计数', () => {
  const report = reportS02([
    { id: 'O-401', storeId: 'S02', deliveryMethod: 'pickup', status: '已核销' },
    { id: 'O-401', storeId: 'S02', deliveryMethod: 'pickup', status: '已核销' },
  ], []);
  assert.equal(report.rows.filter(({ orderId }) => orderId === 'O-401').length, 1);
  assert.equal(report.metrics.pickedUp, 1);
});

test('FJ-57 其他门店的已核销自提单不进入 S02 日报', () => {
  const report = reportS02();
  assert.equal(report.rows.some(({ orderId }) => orderId === 'O-403'), false);
  assert.equal(report.metrics.pickedUp, 1);
});

test('FJ-57 非自提单展示与已发货计数沿用出库回执口径', () => {
  const expected = shipmentStatus(S02_DAILY_EVENTS, S02_OBSERVED_AT);
  const report = reportS02();
  const row = report.rows.find(({ orderId }) => orderId === 'O-404');
  assert.equal(row.reportStatus, expected.status);
  assert.equal(report.metrics.shipped, expected.count);
});
