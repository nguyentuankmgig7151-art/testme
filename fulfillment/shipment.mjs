export function shipmentStatus(events, observedAt) {
  const accepted = events.filter(({ at }) => observedAt - at < 300_000 && observedAt >= at);
  return { status: accepted.length ? '已发货' : '待发货', count: accepted.length };
}
