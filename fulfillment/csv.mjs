export function exportShipments(orders, storeId) {
  const rows = orders.filter(order => order.storeId === storeId && order.status === '已发货');
  return ['order_id,store_id,status', ...rows.map(order => [order.id, order.storeId, order.status].join(','))].join('\n') + '\n';
}
