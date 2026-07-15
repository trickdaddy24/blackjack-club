import { describe, it, expect } from "vitest";
import { currentPromo, promoStatus, PROMO_SCHEDULE } from "./promotions";

// July dates → PDT (UTC-7), so "-07:00" offsets pin the Vegas clock exactly.
const pt = (time: string) => new Date(`2026-07-15T${time}:00-07:00`);

describe("currentPromo", () => {
  it("runs Happy Hour 5pm–7pm PT", () => {
    expect(currentPromo(pt("17:00"))?.id).toBe("happy-hour");
    expect(currentPromo(pt("18:59"))?.id).toBe("happy-hour");
    expect(currentPromo(pt("19:00"))).toBeNull();
    expect(currentPromo(pt("16:59"))).toBeNull();
  });

  it("runs Midnight Madness midnight–2am PT", () => {
    expect(currentPromo(pt("00:30"))?.id).toBe("midnight-madness");
    expect(currentPromo(pt("01:59"))?.id).toBe("midnight-madness");
    expect(currentPromo(pt("02:00"))).toBeNull();
  });

  it("is quiet through the ordinary afternoon", () => {
    expect(currentPromo(pt("12:00"))).toBeNull();
  });
});

describe("promoStatus", () => {
  it("counts down the end of an active promo", () => {
    const s = promoStatus(pt("18:30"));
    expect(s.active?.id).toBe("happy-hour");
    expect(s.endsInMinutes).toBe(30);
    expect(s.startsInMinutes).toBeNull();
  });

  it("teases the next promo with minutes until it starts", () => {
    const s = promoStatus(pt("16:00"));
    expect(s.active).toBeNull();
    expect(s.next.id).toBe("happy-hour");
    expect(s.startsInMinutes).toBe(60);
  });

  it("wraps past midnight to find the next promo", () => {
    const s = promoStatus(pt("20:00")); // after happy hour → midnight madness at 00:00
    expect(s.active).toBeNull();
    expect(s.next.id).toBe("midnight-madness");
    expect(s.startsInMinutes).toBe(240);
  });
});

describe("PROMO_SCHEDULE", () => {
  it("windows stay inside a single day and never overlap", () => {
    for (const p of PROMO_SCHEDULE) {
      expect(p.from).toBeLessThan(p.to);
      expect(p.from).toBeGreaterThanOrEqual(0);
      expect(p.to).toBeLessThanOrEqual(24);
    }
    const sorted = [...PROMO_SCHEDULE].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].from).toBeGreaterThanOrEqual(sorted[i - 1].to);
    }
  });
});
