import { describe, expect, test } from "vitest";
import { segmentosDeEnfasis, sinEnfasis } from "./enfasisTexto";

describe("segmentosDeEnfasis", () => {
  test("convierte *…* en cursiva sin perder el texto vecino", () => {
    expect(segmentosDeEnfasis("En el último año, *¿quién fue la persona agresora?*")).toEqual([
      { texto: "En el último año, ", enfasis: null },
      { texto: "¿quién fue la persona agresora?", enfasis: "cursiva" },
    ]);
  });

  test("los marcadores dobles son negrita y ganan a los simples", () => {
    expect(segmentosDeEnfasis("Marca **solo una** opción")).toEqual([
      { texto: "Marca ", enfasis: null },
      { texto: "solo una", enfasis: "fuerte" },
      { texto: " opción", enfasis: null },
    ]);
    expect(segmentosDeEnfasis("__Nota__ final")[0]).toEqual({ texto: "Nota", enfasis: "fuerte" });
  });

  test("el guion bajo dentro de un nombre de variable no es énfasis", () => {
    expect(sinEnfasis("Revisa p13_1_otro y p2_a")).toBe("Revisa p13_1_otro y p2_a");
    expect(segmentosDeEnfasis("una _palabra_ suelta")[1]).toEqual({ texto: "palabra", enfasis: "cursiva" });
  });

  test("un asterisco sin pareja o rodeado de espacios se conserva", () => {
    expect(sinEnfasis("Precio * cantidad")).toBe("Precio * cantidad");
    expect(sinEnfasis("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(sinEnfasis("Obligatoria*")).toBe("Obligatoria*");
  });

  test("sin texto no hay segmentos", () => {
    expect(segmentosDeEnfasis("")).toEqual([]);
    expect(segmentosDeEnfasis(null)).toEqual([]);
    expect(sinEnfasis(undefined)).toBe("");
  });

  test("sinEnfasis quita todos los marcadores reconocidos", () => {
    expect(sinEnfasis("*¿Qué* hiciste **después**?")).toBe("¿Qué hiciste después?");
  });
});
