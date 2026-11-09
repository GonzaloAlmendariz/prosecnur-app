import { describe, expect, test } from "vitest";
import { esIndicadorVacio, separarIndicadoresVacios } from "./indicadoresVacios";

const kpi = (label: string, value: number | null, texto?: string) => ({ label, value, texto });

describe("franja del diseño: los indicadores vacíos se juntan (L18)", () => {
  test('vacío es sin cifra y sin texto, o con el "—" de relleno', () => {
    expect(esIndicadorVacio(kpi("Muestra", null))).toBe(true);
    expect(esIndicadorVacio(kpi("Método", null, "—"))).toBe(true);
    expect(esIndicadorVacio(kpi("Método", null, "alumnos por CH"))).toBe(false);
    expect(esIndicadorVacio(kpi("Universo", 0))).toBe(false);
  });

  test("desde dos vacíos salen de la rejilla, en su orden", () => {
    const { conValor, vacios } = separarIndicadoresVacios([kpi("A", 10), kpi("B", null), kpi("C", 3), kpi("D", null, "—")]);
    expect(conValor.map((k) => k.label)).toEqual(["A", "C"]);
    expect(vacios.map((k) => k.label)).toEqual(["B", "D"]);
  });

  test("un solo vacío se queda en su casilla", () => {
    const { conValor, vacios } = separarIndicadoresVacios([kpi("A", 10), kpi("B", null)]);
    expect(conValor.map((k) => k.label)).toEqual(["A", "B"]);
    expect(vacios).toEqual([]);
  });
});
