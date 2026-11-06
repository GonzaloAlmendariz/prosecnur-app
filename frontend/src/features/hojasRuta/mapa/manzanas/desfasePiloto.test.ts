import { describe, expect, test } from "vitest";
import { reglaPilotoDesfasada } from "./desfasePiloto";

describe("regla del piloto en Campo real (P2 de la paridad)", () => {
  test("avisa cuando la muestra se sorteó con la otra regla", () => {
    expect(reglaPilotoDesfasada("exclude_titulars", 150, 0)).toBe(true);
    expect(reglaPilotoDesfasada("ignore", 150, 150)).toBe(true);
  });
  test("no avisa si coincide, sin muestra o con un piloto sin titulares", () => {
    expect(reglaPilotoDesfasada("exclude_titulars", 150, 150)).toBe(false);
    expect(reglaPilotoDesfasada("ignore", 150, 0)).toBe(false);
    expect(reglaPilotoDesfasada("exclude_titulars", 150, null)).toBe(false);
    expect(reglaPilotoDesfasada("exclude_titulars", 0, 0)).toBe(false);
  });
});
