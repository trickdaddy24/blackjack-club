import { describe, it, expect } from "vitest";
import { vegasDayStart, vegasWeekStart } from "./leaderboard";

const ptHour = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hourCycle: "h23",
    }).format(d)
  );
const ptDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const ptWeekday = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(d);

describe("vegasDayStart", () => {
  it("returns PT midnight of the same PT day (summer, PDT)", () => {
    // 2026-07-15 23:30 PT (deep evening) and 00:30 PT (just past midnight)
    const evening = new Date("2026-07-15T23:30:00-07:00");
    const start = vegasDayStart(evening);
    expect(ptHour(start)).toBe(0);
    expect(ptDate(start)).toBe("2026-07-15");

    const early = new Date("2026-07-15T00:30:00-07:00");
    expect(ptDate(vegasDayStart(early))).toBe("2026-07-15");
  });

  it("handles winter (PST) too", () => {
    const jan = new Date("2026-01-10T22:00:00-08:00");
    const start = vegasDayStart(jan);
    expect(ptHour(start)).toBe(0);
    expect(ptDate(start)).toBe("2026-01-10");
  });

  it("a UTC-evening instant still resolves to the PT day", () => {
    // 2026-07-16T02:00Z is 7pm PT on the 15th
    const d = new Date("2026-07-16T02:00:00Z");
    expect(ptDate(vegasDayStart(d))).toBe("2026-07-15");
  });
});

describe("vegasWeekStart", () => {
  it("anchors to Monday midnight PT", () => {
    // 2026-07-15 is a Wednesday; the week began Monday 2026-07-13
    const wed = new Date("2026-07-15T12:00:00-07:00");
    const start = vegasWeekStart(wed);
    expect(ptWeekday(start)).toBe("Mon");
    expect(ptDate(start)).toBe("2026-07-13");
    expect(ptHour(start)).toBe(0);
  });

  it("a Monday stays in its own week; a Sunday reaches back six days", () => {
    const mon = new Date("2026-07-13T08:00:00-07:00");
    expect(ptDate(vegasWeekStart(mon))).toBe("2026-07-13");
    const sun = new Date("2026-07-19T20:00:00-07:00");
    expect(ptDate(vegasWeekStart(sun))).toBe("2026-07-13");
  });
});
