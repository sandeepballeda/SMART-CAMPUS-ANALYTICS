import { describe, expect, it } from "vitest";

import {
  ageFrom,
  filterDirectory,
  formatDate,
  isTeachingStaff,
  missingPersonalFields,
  type DirectoryRow,
} from "@/lib/directory";

const row = (over: Partial<DirectoryRow>): DirectoryRow => ({
  id: crypto.randomUUID(),
  full_name: "",
  email: null,
  phone: null,
  designation: null,
  qualification: null,
  experience_years: null,
  date_of_birth: null,
  gender: null,
  blood_group: null,
  personal_email: null,
  address: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  date_of_joining: null,
  department: null,
  roles: ["teacher"],
  ...over,
});

const teacher = row({ full_name: "Priya Nair", email: "priya@campus.edu", phone: "+91 9800160159", department: "CSE" });
const hod = row({ full_name: "Dr. Anita Sharma", email: "hod.cse@campus.edu", phone: "+91 9851976165", department: "CSE", roles: ["hod", "teacher"] });
const admin = row({ full_name: "Dr. Rajesh Kumar", email: "admin@campus.edu", phone: "+91 9890657160", department: null, roles: ["admin"] });
const otherDept = row({ full_name: "Sneha Iyer", email: "sneha@campus.edu", phone: "+91 9876892361", department: "ECE" });
const all = [teacher, hod, admin, otherDept];

describe("Teacher directory", () => {
  it("lists teachers and HODs but never admin-only accounts", () => {
    const names = filterDirectory(all, {}).map((r) => r.full_name);
    expect(names).toEqual(["Priya Nair", "Dr. Anita Sharma", "Sneha Iyer"]);
    expect(names).not.toContain("Dr. Rajesh Kumar");
    expect(isTeachingStaff({ roles: ["admin"] })).toBe(false);
    expect(isTeachingStaff({ roles: ["hod", "teacher"] })).toBe(true);
  });

  it("filters by department code", () => {
    const names = filterDirectory(all, { dept: "CSE" }).map((r) => r.full_name);
    expect(names).toEqual(["Priya Nair", "Dr. Anita Sharma"]);
  });

  it("finds a teacher by a fragment of their phone number", () => {
    expect(filterDirectory(all, { q: "980016" }).map((r) => r.full_name)).toEqual(["Priya Nair"]);
    expect(filterDirectory(all, { q: "sneha" }).map((r) => r.full_name)).toEqual(["Sneha Iyer"]);
    expect(filterDirectory(all, { q: "zzz" })).toEqual([]);
  });

  it("shows dates as day-month-year and hides missing ones", () => {
    expect(formatDate("1990-04-12")).toBe("12 Apr 1990");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("computes age only once the birthday has passed", () => {
    const today = new Date(2026, 10, 4); // 4 Nov 2026
    expect(ageFrom("1990-04-12", today)).toBe(36);
    expect(ageFrom("1990-12-02", today)).toBe(35);
    expect(ageFrom(null, today)).toBeNull();
  });

  it("reports which personal details still need filling in", () => {
    const empty = row({ full_name: "Kavya Reddy" });
    expect(missingPersonalFields(empty)).toEqual([
      "Phone",
      "Date of birth",
      "Gender",
      "Blood group",
      "Personal email",
      "Address",
      "Emergency contact",
      "Emergency phone",
      "Date of joining",
    ]);
    expect(missingPersonalFields(teacher)).toEqual([
      "Date of birth",
      "Gender",
      "Blood group",
      "Personal email",
      "Address",
      "Emergency contact",
      "Emergency phone",
      "Date of joining",
    ]);
  });
});
