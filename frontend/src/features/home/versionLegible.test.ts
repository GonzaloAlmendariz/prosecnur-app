import { describe, expect, it } from "vitest";
import { versionLegible } from "./HomePage";

describe("versionLegible (pie del Home)", () => {
  it("no repite la versión cuando app y motor coinciden", () => {
    expect(versionLegible("app v0.9.6, prosecnur v0.9.6")).toBe("v0.9.6");
  });
  it("muestra las dos cuando difieren", () => {
    expect(versionLegible("app v0.9.6, prosecnur v0.9.5")).toBe("app v0.9.6, prosecnur v0.9.5");
  });
});
