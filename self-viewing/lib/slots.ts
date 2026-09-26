// Fake availability. Production: read the agency's viewing calendar / lock
// availability. Slots are generated relative to "now" so the demo never goes stale.

export type Slot = { id: string; start: string; end: string };

const HOURS = [10, 12.5, 15, 17.5];

export function getAvailableSlots(days = 3): Slot[] {
  const out: Slot[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let d = 1; d <= days; d++) {
    for (const [i, h] of HOURS.entries()) {
      if ((d + i) % 3 === 0) continue; // a few slots "taken"
      const start = new Date(base);
      start.setDate(base.getDate() + d);
      start.setHours(Math.floor(h), (h % 1) * 60);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      out.push({ id: start.toISOString(), start: start.toISOString(), end: end.toISOString() });
    }
  }
  return out;
}

export function formatWindow(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const day = s.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t(s)} – ${t(e)}`;
}
