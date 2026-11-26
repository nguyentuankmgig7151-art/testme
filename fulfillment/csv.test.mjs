import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportShipments } from './csv.mjs';

const orders = [
  { id: 'O-104', storeId: 'S01', status: '已发货' },
  { id: 'O-105', storeId: 'S01', status: '已发货' },
  { id: 'O-106', storeId: 'S02', status: '已发货' },
  { id: 'O-107', storeId: 'S01', status: '待发货' },
];
test('exports both shipped records in the selected store only', () => {
  assert.equal(exportShipments(orders, 'S01'),
    'order_id,store_id,status\nO-104,S01,已发货\nO-105,S01,已发货\n');
});
test('keeps a header for an empty store', () => {
  assert.equal(exportShipments(orders, 'EMPTY'), 'order_id,store_id,status\n');
});
