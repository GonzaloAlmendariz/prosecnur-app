import { describe, expect, test } from "vitest";
import { MANIFIESTO_NAVEGACION } from "./manifiesto";
import { buscarEnPaleta } from "./paleta";

describe("paleta de comandos (L30)", () => {
  test("busca sobre el manifiesto entero: sin consulta ofrece vistas", () => {
    expect(MANIFIESTO_NAVEGACION.length).toBeGreaterThan(50);
    expect(buscarEnPaleta(MANIFIESTO_NAVEGACION, "", 5)).toHaveLength(5);
  });

  test("ignora tildes y mayúsculas, y cada resultado dice de dónde cuelga", () => {
    const r = buscarEnPaleta(MANIFIESTO_NAVEGACION, "VALIDACION");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].label.toLowerCase()).toContain("validaci");
    expect(r.every((x) => x.href.startsWith("/"))).toBe(true);
  });

  test("varias palabras acotan por las migas: «semana cronograma» llega a la vista semanal", () => {
    const r = buscarEnPaleta(MANIFIESTO_NAVEGACION, "semana cronograma");
    expect(r[0].label).toBe("Semana");
    expect(r[0].href).toContain("seccion=cronograma&pestana=semana");
  });

  test("una consulta sin coincidencias devuelve vacío", () => {
    expect(buscarEnPaleta(MANIFIESTO_NAVEGACION, "zzzqqq")).toEqual([]);
  });
});
