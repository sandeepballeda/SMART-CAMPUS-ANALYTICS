import { describe, it, expect } from "vitest";
import { workloadStatus } from "@/lib/analytics";

describe("faculty workload", () => {
  it("flags more than 16 hrs/week as overloaded", () => expect(workloadStatus(17)).toBe("overloaded"));
  it("flags fewer than 6 hrs/week as underutilized", () => expect(workloadStatus(5)).toBe("underutilized"));
  it("treats 6–16 hrs/week as balanced", () => { expect(workloadStatus(6)).toBe("balanced"); expect(workloadStatus(16)).toBe("balanced"); });
});
