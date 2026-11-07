import { describe, expect, test } from "vitest";
import { mensajeBitacoraVacia } from "./BitacoraSeccion";

describe("bitácora vacía (B23)", () => {
  test("con muestra ya hecha dice que el proyecto es anterior a la bitácora", () => {
    expect(mensajeBitacoraVacia(true)).toMatch(/antes de que existiera la bitácora/);
  });
  test("sin decisiones previas invita a empezar", () => {
    expect(mensajeBitacoraVacia(false)).toMatch(/^Todavía no hay decisiones registradas/);
  });
});
