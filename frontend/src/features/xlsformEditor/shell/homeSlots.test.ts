import { describe, expect, it } from "vitest";
import { computeHomeSlots } from "./homeSlots";
import { MAX_FORMS } from "../state/persistence";

describe("computeHomeSlots", () => {
  it("estado vacío: protagonista + fantasmas para el resto de la capacidad", () => {
    const s = computeHomeSlots(0);
    expect(s.empty).toBe(true);
    expect(s.canCreate).toBe(true);
    expect(s.atLimit).toBe(false);
    // 0 formularios + 1 tarjeta de creación → MAX-1 fantasmas.
    expect(s.ghostSlots).toBe(MAX_FORMS - 1);
  });

  it("estado intermedio: descuenta formularios y la tarjeta de creación", () => {
    const s = computeHomeSlots(3);
    expect(s.empty).toBe(false);
    expect(s.canCreate).toBe(true);
    expect(s.atLimit).toBe(false);
    expect(s.ghostSlots).toBe(MAX_FORMS - 3 - 1);
  });

  it("un slot antes del tope: sigue habiendo cupo y cero fantasmas", () => {
    const s = computeHomeSlots(MAX_FORMS - 1);
    expect(s.canCreate).toBe(true);
    expect(s.atLimit).toBe(false);
    expect(s.ghostSlots).toBe(0);
  });

  it("en el tope: sin cupo, sin tarjeta de creación, sin fantasmas", () => {
    const s = computeHomeSlots(MAX_FORMS);
    expect(s.canCreate).toBe(false);
    expect(s.atLimit).toBe(true);
    expect(s.ghostSlots).toBe(0);
  });

  it("clamp defensivo: un conteo por encima del tope no genera negativos", () => {
    const s = computeHomeSlots(MAX_FORMS + 5);
    expect(s.count).toBe(MAX_FORMS);
    expect(s.canCreate).toBe(false);
    expect(s.atLimit).toBe(true);
    expect(s.ghostSlots).toBe(0);
  });

  it("clamp defensivo: conteo negativo se trata como vacío", () => {
    const s = computeHomeSlots(-2);
    expect(s.count).toBe(0);
    expect(s.empty).toBe(true);
    expect(s.ghostSlots).toBe(MAX_FORMS - 1);
  });

  it("respeta un max explícito distinto", () => {
    const s = computeHomeSlots(1, 3);
    expect(s.atLimit).toBe(false);
    expect(s.ghostSlots).toBe(1); // 1 form + 1 add card → 1 fantasma
  });
});
