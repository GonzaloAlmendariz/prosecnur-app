import { describe, expect, it } from "vitest";
import { resolverPestanaGraficos } from "./pestanaGraficos";

describe("resolverPestanaGraficos", () => {
  it("aterriza en Láminas sin pestaña o con una desconocida", () => {
    expect(resolverPestanaGraficos(null)).toBe("laminas");
    expect(resolverPestanaGraficos("timeline")).toBe("laminas");
  });
  it("respeta el editor anterior", () => {
    expect(resolverPestanaGraficos("clasico")).toBe("clasico");
    expect(resolverPestanaGraficos("Clasico")).toBe("clasico");
  });
});
