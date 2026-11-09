import { describe, expect, test } from "vitest";
import { subDelCuestionario } from "./moduleCardModel";

describe('subDelCuestionario: la tarjeta de Formularios no dice "en edición" de otro borrador', () => {
  test("la cifra sale del borrador del editor", () => {
    expect(subDelCuestionario({ questions_count: 12, draft_questions_count: 12, from_instrument: false })).toBe("Cuestionario en edición");
  });
  test("backend anterior sin los campos nuevos", () => {
    expect(subDelCuestionario({ questions_count: 12 })).toBe("Cuestionario en edición");
  });
  test("instrumento vinculado y el editor con otro borrador", () => {
    expect(subDelCuestionario({ questions_count: 66, draft_questions_count: 1, from_instrument: true })).toBe(
      "Instrumento del estudio; el editor tiene abierto un borrador de 1 pregunta",
    );
  });
  test("instrumento vinculado y el editor vacío", () => {
    expect(subDelCuestionario({ questions_count: 66, draft_questions_count: 0, from_instrument: true })).toBe(
      "Instrumento del estudio; todavía no está abierto en el editor",
    );
  });
});
