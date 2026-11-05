import { describe, expect, it } from "vitest";
import { resumenHistorial } from "./resumenHistorial";

describe("resumen del historial de ruteos", () => {
  it("dice cuántos sorteos hay y si uno está en uso", () => {
    expect(resumenHistorial(0, false)).toBe("Sin sorteos todavía");
    expect(resumenHistorial(1, true)).toBe("1 sorteo, en uso");
    expect(resumenHistorial(3, true)).toBe("3 sorteos, uno en uso");
    expect(resumenHistorial(2, false)).toBe("2 sorteos, ninguno en uso");
  });
});
