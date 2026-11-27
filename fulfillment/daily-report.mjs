import { shipmentStatus } from './shipment.mjs';

const DELIVERY_METHOD_PICKUP = 'pickup';
const ORDER_STATUS_REDEEMED = '已核销';
const REPORT_STATUS_PICKED_UP = '已提货';
const REPORT_STATUS_AWAITING_PICKUP = '待提货';

// 同一订单可能有当日多条记录（重复核销、补录），已核销事实优先，保证报表一单一计
function mergeOrderRecords(storeOrders) {
  const merged = new Map();
  for (const order of storeOrders) {
    const previous = merged.get(order.id);
    if (!previous) {
      merged.set(order.id, { ...order });
      continue;
    }
    const redeemed = previous.status === ORDER_STATUS_REDEEMED || order.status === ORDER_STATUS_REDEEMED;
    merged.set(order.id, { ...previous, ...order, status: redeemed ? ORDER_STATUS_REDEEMED : order.status });
  }
  return [...merged.values()];
}

function reportStatusOf(order, shipment) {
  if (order.deliveryMethod !== DELIVERY_METHOD_PICKUP) {
    // 非自提单沿用既有出库回执口径，本模块不改变其判定
    return shipment.status;
  }
  return order.status === ORDER_STATUS_REDEEMED ? REPORT_STATUS_PICKED_UP : REPORT_STATUS_AWAITING_PICKUP;
}

export function buildStoreDailyReport({ storeId, orders = [], shipmentEvents = [], observedAt = 0 } = {}) {
  const storeOrders = mergeOrderRecords(orders.filter((order) => order.storeId === storeId));
  // 出库回执按门店取数，与 shipment.mjs 的门店口径保持一致
  const shipment = shipmentStatus(shipmentEvents.filter((event) => event.storeId === storeId), observedAt);

  const rows = storeOrders.map((order) => ({
    orderId: order.id,
    storeId: order.storeId,
    deliveryMethod: order.deliveryMethod,
    status: order.status,
    reportStatus: reportStatusOf(order, shipment),
  }));

  const pickedUp = rows.filter((row) => row.reportStatus === REPORT_STATUS_PICKED_UP).length;

  return { storeId, rows, metrics: { pickedUp, shipped: shipment.count } };
}
