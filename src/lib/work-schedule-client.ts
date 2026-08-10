export function formatScheduleTime12h(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatScheduleRange(from: Date, to: Date | null) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (!to) return `${fmt(from)} onwards`;
  return `${fmt(from)} - ${fmt(to)}`;
}
