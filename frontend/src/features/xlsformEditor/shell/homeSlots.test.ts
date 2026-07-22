import { describe, expect, it } from "vitest";
import { computeHomeSlots } from "./homeSlots";
import { MAX_FORMS } from "../state/persistence";

describe("computeHomeSlots", () => {
  it("estado vacío: la creación protagonista no añade slots fantasma", () => {
    const slots = computeHomeSlots(0);

    expect(slots).toMatchObject({
      count: 0,
      empty: true,
      canCreate: true,
      atLimit: false,
      ghostSlots: 0,
    });
  });

  it("estado intermedio: conserva la creación sin reservar tarjetas vacías", () => {
    const slots = computeHomeSlots(3);

    expect(slots.empty).toBe(false);
    expect(slots.canCreate).toBe(true);
    expect(slots.atLimit).toBe(false);
    expect(slots.ghostSlots).toBe(0);
  });

  it("un slot antes del tope: sigue habiendo cupo y cero fantasmas", () => {
    const slots = computeHomeSlots(MAX_FORMS - 1);

    expect(slots.canCreate).toBe(true);
    expect(slots.atLimit).toBe(false);
    expect(slots.ghostSlots).toBe(0);
  });

  it("en el tope: sin cupo, sin tarjeta de creación, sin fantasmas", () => {
    const slots = computeHomeSlots(MAX_FORMS);

    expect(slots.canCreate).toBe(false);
    expect(slots.atLimit).toBe(true);
    expect(slots.ghostSlots).toBe(0);
  });

  it("clamp defensivo: un conteo por encima del tope no genera negativos", () => {
    const slots = computeHomeSlots(MAX_FORMS + 5);

    expect(slots.count).toBe(MAX_FORMS);
    expect(slots.canCreate).toBe(false);
    expect(slots.atLimit).toBe(true);
    expect(slots.ghostSlots).toBe(0);
  });

  it("clamp defensivo: conteo negativo se trata como vacío sin fantasmas", () => {
    const slots = computeHomeSlots(-2);

    expect(slots.count).toBe(0);
    expect(slots.empty).toBe(true);
    expect(slots.ghostSlots).toBe(0);
  });

  it("respeta un max explícito distinto", () => {
    const slots = computeHomeSlots(1, 3);

    expect(slots.atLimit).toBe(false);
    expect(slots.ghostSlots).toBe(0);
  });
});
