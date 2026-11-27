export function shipmentStatus(events, observedAt) {
  const eligible = events.filter(({ at, cancelled }) => !cancelled && observedAt - at <= 300_000 && observedAt >= at);
  const eventsByStore = new Map();
  let count = 0;
  for (const { storeId, id } of eligible) {
    const storeEvents = eventsByStore.get(storeId) ?? new Set();
    if (!storeEvents.has(id)) {
      storeEvents.add(id);
      count += 1;
    }
    eventsByStore.set(storeId, storeEvents);
  }
  return { status: count ? '已发货' : '待发货', count };
}
