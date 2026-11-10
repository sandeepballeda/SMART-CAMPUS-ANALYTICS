import { describe, expect, it } from "vitest";
import { findClashes, missingSessions, leaveAffectedSlots, lowAttendance } from "@/lib/campus-tools";

const slot = (id: string, day: number, s: string, e: string, teacher: string, room: string | null = null) =>
  ({ id, allocation_id: `a-${id}`, day_of_week: day, start_time: s, end_time: e, teacher_id: teacher, room });

describe("campus tools", () => {
  it("flags overlapping classes for the same teacher", () => {
    const c = findClashes([slot("1", 1, "09:00", "10:00", "t1"), slot("2", 1, "09:30", "10:30", "t1"), slot("3", 1, "10:00", "11:00", "t1")]);
    expect([...c].sort()).toEqual(["1", "2", "3"]);
  });
  it("flags same room double-booked, ignores back-to-back", () => {
    expect(findClashes([slot("1", 2, "09:00", "10:00", "t1", "R1"), slot("2", 2, "09:00", "10:00", "t2", "r1")]).size).toBe(2);
    expect(findClashes([slot("1", 2, "09:00", "10:00", "t1", "R1"), slot("2", 2, "10:00", "11:00", "t1", "R1")]).size).toBe(0);
  });
  it("lists scheduled classes in the last 7 days without attendance", () => {
    // 2026-11-09 is a Monday (1)
    const out = missingSessions([{ allocation_id: "a", day_of_week: 1 }], [{ allocation_id: "a", class_date: "2026-11-02" }], "2026-11-09");
    expect(out).toEqual([{ allocation_id: "a", date: "2026-11-09" }]);
  });
  it("finds classes missed during leave", () => {
    const out = leaveAffectedSlots("2026-11-09", "2026-11-11", [{ day_of_week: 1 }, { day_of_week: 3 }, { day_of_week: 5 }]);
    expect(out.map((x) => x.date)).toEqual(["2026-11-09", "2026-11-11"]);
  });
  it("alerts classes below 75% attendance only", () => {
    expect(lowAttendance([{ attendancePct: 74.9 }, { attendancePct: 75 }, { attendancePct: null }, { attendancePct: 60 }])).toEqual([{ attendancePct: 60 }, { attendancePct: 74.9 }]);
  });
});
