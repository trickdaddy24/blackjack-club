import { describe, it, expect } from "vitest";
import { currentTableMinimum } from "./tableMinimum";

// July dates: Vegas is UTC-7 (PDT)
describe("currentTableMinimum", () => {
  it("runs $5 morning rates (4am–noon PT)", () => {
    expect(currentTableMinimum(new Date("2026-07-03T15:00:00Z"))).toEqual({
      min: 5,
      label: "morning rates",
    }); // 8am PT
  });

  it("runs the standard $15 afternoons (noon–6pm PT)", () => {
    expect(currentTableMinimum(new Date("2026-07-03T20:00:00Z"))).toEqual({
      min: 15,
      label: "afternoon rates",
    }); // 1pm PT
  });

  it("runs $25 evenings (6pm–2am PT)", () => {
    expect(currentTableMinimum(new Date("2026-07-04T02:00:00Z")).min).toBe(25); // 7pm PT
    expect(currentTableMinimum(new Date("2026-07-04T08:30:00Z")).min).toBe(25); // 1:30am PT
  });

  it("runs $10 late night (2am–4am PT)", () => {
    expect(currentTableMinimum(new Date("2026-07-03T10:00:00Z"))).toEqual({
      min: 10,
      label: "late-night rates",
    }); // 3am PT
  });
});
