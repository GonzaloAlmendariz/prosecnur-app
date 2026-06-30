import { describe, expect, it } from "vitest";
import {
  territorialDurationOperationalStatusFromSeconds,
  territorialDurationOperationalStatusFromValues,
  territorialDurationReviewPriority,
  territorialDurationReviewReasonKey,
} from "./territorialDuration";

describe("territorialDuration", () => {
  it("classifies territorial durations with fixed 2 and 5 minute thresholds", () => {
    expect(territorialDurationOperationalStatusFromSeconds(119)).toBe("muy_corto");
    expect(territorialDurationOperationalStatusFromSeconds(120)).toBe("corto");
    expect(territorialDurationOperationalStatusFromSeconds(299)).toBe("corto");
    expect(territorialDurationOperationalStatusFromSeconds(300)).toBe("normal");
    expect(territorialDurationOperationalStatusFromSeconds(8000)).toBe("normal");
  });

  it("uses seconds before stale duration labels when seconds are available", () => {
    expect(territorialDurationOperationalStatusFromValues({
      seconds: 300,
      durationStatus: "muy_corta",
      durationOperationalStatus: "muy_corto",
      durationOperationalLabel: "Muy corto",
    })).toBe("normal");
  });

  it("keeps label fallbacks for records without seconds", () => {
    expect(territorialDurationOperationalStatusFromValues({ durationStatus: "muy_corta" })).toBe("muy_corto");
    expect(territorialDurationOperationalStatusFromValues({ durationOperationalLabel: "Corto" })).toBe("corto");
    expect(territorialDurationOperationalStatusFromValues({ durationStatus: "larga" })).toBe("normal");
  });

  it("orders review cases and exposes current reason keys", () => {
    expect(territorialDurationReviewPriority("muy_corto")).toBeLessThan(territorialDurationReviewPriority("corto"));
    expect(territorialDurationReviewReasonKey("muy_corto")).toBe("duracion_menor_2_min");
    expect(territorialDurationReviewReasonKey("corto")).toBe("duracion_menor_5_min");
  });
});
