import { describe, expect, it } from "vitest";
import { quedanMasAbajo } from "./useQuedanMasAbajo";

describe("quedanMasAbajo", () => {
  it("sólo es verdad si algo queda bajo el borde inferior", () => {
    expect(quedanMasAbajo(600, 0, 300)).toBe(true);
    expect(quedanMasAbajo(600, 300, 300)).toBe(false);
    expect(quedanMasAbajo(280, 0, 300)).toBe(false);
    // Redondeo de subpíxel al final del desplazamiento.
    expect(quedanMasAbajo(600.5, 300, 300)).toBe(false);
  });
});
