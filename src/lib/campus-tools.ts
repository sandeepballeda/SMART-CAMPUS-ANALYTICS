/** Pure helpers for timetable clashes, missing attendance, leave impact and low-attendance alerts. */

export const LOW_ATTENDANCE_PCT = 75;

export type Slot = {
  id: string;
  allocation_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher_id: string;
};

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Ids of slots that overlap another slot on the same day for the same teacher or same room. */
export function findClashes(slots: Slot[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!, b = slots[j]!;
      if (a.day_of_week !== b.day_of_week) continue;
      const overlap = toMin(a.start_time) < toMin(b.end_time) && toMin(b.start_time) < toMin(a.end_time);
      if (!overlap) continue;
      const sameRoom = !!a.room && a.room.trim().toLowerCase() === (b.room ?? "").trim().toLowerCase();
      if (a.teacher_id === b.teacher_id || sameRoom) { out.add(a.id); out.add(b.id); }
    }
  }
  return out;
}

const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, d!)); };
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Every date (inclusive) between two ISO dates. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = parse(start); d <= parse(end); d = new Date(d.getTime() + 86400000)) out.push(fmt(d));
  return out;
}

/** Scheduled classes in the last `days` days (ending today) that have no attendance recorded for that date. */
export function missingSessions(
  slots: Pick<Slot, "allocation_id" | "day_of_week">[],
  recorded: { allocation_id: string; class_date: string }[],
  today: string,
  days = 7,
): { allocation_id: string; date: string }[] {
  const have = new Set(recorded.map((r) => `${r.allocation_id}|${r.class_date}`));
  const start = fmt(new Date(parse(today).getTime() - (days - 1) * 86400000));
  const seen = new Set<string>();
  const out: { allocation_id: string; date: string }[] = [];
  for (const date of datesBetween(start, today)) {
    const dow = parse(date).getUTCDay();
    for (const s of slots) {
      const key = `${s.allocation_id}|${date}`;
      if (s.day_of_week !== dow || have.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ allocation_id: s.allocation_id, date });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Classes a teacher would miss during a leave period. */
export function leaveAffectedSlots<T extends Pick<Slot, "day_of_week">>(start: string, end: string, slots: T[]) {
  return datesBetween(start, end).flatMap((date) => {
    const dow = parse(date).getUTCDay();
    return slots.filter((s) => s.day_of_week === dow).map((slot) => ({ date, slot }));
  });
}

/** Classes whose average attendance is under the threshold, worst first. */
export function lowAttendance<T extends { attendancePct: number | null }>(allocs: T[]) {
  return allocs
    .filter((a) => a.attendancePct != null && a.attendancePct < LOW_ATTENDANCE_PCT)
    .sort((a, b) => a.attendancePct! - b.attendancePct!);
}
