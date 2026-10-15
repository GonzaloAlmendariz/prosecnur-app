import { describe, expect, it } from "vitest";
import { conCategorias, conLeyenda, conNegrita, leerCategorias, leerLeyenda, leerNegrita, legibilidadModificada, sinLegibilidad } from "./modeloLegibilidad";

// O8: negrita por elemento y modo de leyenda, con el contrato del motor (e68a546b5).
describe("legibilidad de los gráficos", () => {
  it("sin decisiones reproduce lo de hoy: todo en negrita salvo la leyenda, la mayor destacada, leyenda automática", () => {
    expect([leerNegrita({}, "cifras"), leerNegrita({}, "leyenda"), leerCategorias({}), leerLeyenda({})]).toEqual([true, false, "mayor", "automatica"]);
    expect(legibilidadModificada({})).toBe(false);
  });

  // Mata: guardar valores iguales al defecto (el motor guarda sólo decisiones) o pisar el resto de `letra`.
  it("guarda sólo lo que cambia y conserva el paso de letra", () => {
    const e = conNegrita({ letra: { paso: "grande" } }, "leyenda", true);
    expect(e.letra).toEqual({ paso: "grande", negrita: { leyenda: true } });
    expect(conNegrita(e, "leyenda", false).letra).toEqual({ paso: "grande" });
    expect(conCategorias({}, "todas").letra).toEqual({ negrita: { categorias: "todas" } });
    expect(conCategorias(conCategorias({}, "todas"), "mayor").letra).toEqual({});
    expect(conLeyenda({}, "dos_filas").letra).toEqual({ leyenda: "dos_filas" });
    expect(conLeyenda(conLeyenda({}, "dos_filas"), "automatica").letra).toEqual({});
  });

  it("volver a lo de siempre quita negrita y leyenda y deja el paso", () => {
    const e = conLeyenda(conNegrita({ letra: { paso: "grande" } }, "cifras", false), "una_fila");
    expect(legibilidadModificada(e)).toBe(true);
    expect(sinLegibilidad(e).letra).toEqual({ paso: "grande" });
  });
});
