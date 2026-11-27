export function shipmentStatus(events, observedAt) {
  const eligible = events.filter(({ at, cancelled }) => !cancelled && observedAt - at < 300_000 && observedAt >= at);
  const accepted = new Set(eligible.map(({ id }) => id));
  return { status: accepted.size ? '已发货' : '待发货', count: accepted.size };
}
