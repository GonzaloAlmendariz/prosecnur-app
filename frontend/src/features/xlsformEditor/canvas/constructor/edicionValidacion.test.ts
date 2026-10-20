import { describe, expect, test } from "vitest";
import { alAplicarFormato, cambiosAlQuitarAtajo } from "./edicionValidacion";

describe("quitar un atajo", () => {
  test("quita la regla en un solo cambio; el mensaje sólo si era el sugerido", () => {
    expect(cambiosAlQuitarAtajo("Ingresa un valor mayor que cero.", ["Ingresa un valor mayor que cero."])).toEqual({ constraint: "", constraint_message: "" });
    expect(cambiosAlQuitarAtajo("Revisa con la persona", ["Ingresa un valor mayor que cero."])).toEqual({ constraint: "" });
  });
});

describe("aplicar un formato", () => {
  test("con el mensaje de otra regla, avisa y ofrece la sugerencia nueva", () => {
    const r = alAplicarFormato("regex(., '^[0-9]{2}:[0-9]{2}$')", "The date format is MM/YYYY", "Escribe la respuesta como 08:30.");
    expect(r).toEqual({ cambios: { constraint: "regex(., '^[0-9]{2}:[0-9]{2}$')" }, ofrecer: "Escribe la respuesta como 08:30." });
  });
  test("sin mensaje, escribe la sugerencia junto con la regla", () => {
    expect(alAplicarFormato("x", "", "Escribe la respuesta como 1.").cambios).toEqual({ constraint: "x", constraint_message: "Escribe la respuesta como 1." });
  });
});
