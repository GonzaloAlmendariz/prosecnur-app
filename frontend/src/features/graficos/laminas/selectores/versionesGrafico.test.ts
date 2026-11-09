// Versiones de un tipo de gráfico (ADR 0139, enmienda 2026-11-09): la tarjeta del tipo ofrece la base y cada variante;
// elegir una aplica sus args fijos y quita los suyos; volver a la base quita el estilo y la regla del resumen; la
// tarjeta muestra elegida la versión candidata, o la actual de la ranura, o la base.
import { describe, expect, it } from "vitest";
import { VARIANTES_GRAFICO } from "../../iconos/catalogoTipos.generated";
import { entradaDeGrafico, nombreConVersion, nombreVersion, nombreVersionBase, varianteGrafico } from "../../catalogoGraficos";
import { esVersionDe, graficoDeVersion, versionesDeTipo, versionMostrada } from "./versionesGrafico";

describe("versiones del tipo", () => {
  it("base y variantes, con los nombres del catálogo (nombre_version / version_base, o el nombre de hoy)", () => {
    const v = versionesDeTipo("p_barras_divergentes");
    expect(v.map((x) => x.id)).toEqual(["p_barras_divergentes", "p_barras_divergentes:escala_sin_informacion"]);
    expect(v[0]).toMatchObject({ nombre: nombreVersionBase("p_barras_divergentes"), variante: null });
    const variante = varianteGrafico("p_barras_divergentes:escala_sin_informacion");
    if (!variante) throw new Error("falta la variante");
    expect(v[1].nombre).toBe(nombreVersion(variante));
    expect(versionesDeTipo("p_pie")).toEqual([]);
  });

  it("el nombre corto de la versión y el de la base usan los campos del catálogo cuando vienen", () => {
    const variante = varianteGrafico("p_dumbbell:contraste");
    if (!variante) throw new Error("falta la variante");
    expect(nombreVersion({ ...variante, nombre_version: "Con columna" })).toBe("Con columna");
    expect(nombreVersion({ ...variante, nombre_version: "  " })).toBe(variante.nombre);
    expect(nombreVersion(variante)).toBe(variante.nombre_version ?? variante.nombre);
  });

  it("toda variante del catálogo es una versión de su graficador", () => {
    for (const v of VARIANTES_GRAFICO) {
      expect(versionesDeTipo(v.graficador).map((x) => x.id)).toContain(v.id);
      expect(esVersionDe(v.id, v.graficador)).toBe(true);
    }
  });
});

describe("versión mostrada (selección y «Actual»)", () => {
  it("la candidata de la tarjeta manda; si no, la actual de la ranura; si no, la base", () => {
    expect(versionMostrada("p_dumbbell", "p_dumbbell:aperturas", "p_dumbbell:contraste")).toBe("p_dumbbell:aperturas");
    expect(versionMostrada("p_dumbbell", null, "p_dumbbell:contraste")).toBe("p_dumbbell:contraste");
    expect(versionMostrada("p_dumbbell", "p_pie", null)).toBe("p_dumbbell");
    // La actual es de otro tipo: la tarjeta muestra su base.
    expect(versionMostrada("p_dumbbell", null, "p_barras_divergentes:escala_sin_informacion")).toBe("p_dumbbell");
  });

  it("la versión actual de un gráfico guardado es su entrada del catálogo", () => {
    expect(entradaDeGrafico("p_barras_divergentes", { estilo: "resumen" })).toBe("p_barras_divergentes:escala_sin_informacion");
    expect(entradaDeGrafico("p_barras_divergentes", {})).toBe("p_barras_divergentes");
  });
});

describe("usar una versión", () => {
  it("una variante escribe sus args fijos y borra los que quita", () => {
    const previo = { graficador: "p_dumbbell", args: { vars: ["p1"], cruce: null, bases: ["a", "b"] } };
    expect(graficoDeVersion("p_dumbbell:aperturas", previo)).toEqual({ graficador: "p_dumbbell", args: { vars: ["p1"], estilo: "resumen" } });
    expect(graficoDeVersion("p_dumbbell:contraste", { graficador: "p_dumbbell", args: {} }).args).toEqual({ estilo: "resumen", cruce: null });
    expect(graficoDeVersion("p_barras_divergentes:escala_sin_informacion", { graficador: "p_barras_divergentes", args: { vars: ["p2"] } }).args)
      .toEqual({ vars: ["p2"], estilo: "resumen" });
  });

  it("volver a la base desde una variante quita el estilo y la regla del resumen", () => {
    expect(graficoDeVersion("p_dumbbell", { graficador: "p_dumbbell", args: { estilo: "resumen", cruce: null, regla: { tipo: "x" } } }).args)
      .toEqual({ cruce: null });
    expect(graficoDeVersion("p_barras_divergentes", { graficador: "p_barras_divergentes", args: { estilo: "resumen", vars: ["p2"] } }).args)
      .toEqual({ vars: ["p2"] });
  });

  it("la base sobre un gráfico que no es variante no toca sus args", () => {
    const base = { graficador: "p_barras_divergentes", args: { vars: ["p2"], estilo: "recetario" } };
    expect(graficoDeVersion("p_barras_divergentes", base)).toBe(base);
  });
});

describe("nombre con versión (inspector y Estructura)", () => {
  it("«<tipo>: <versión>», sin punto medio", () => {
    for (const v of VARIANTES_GRAFICO) {
      const nombre = nombreConVersion(v);
      expect(nombre).toMatch(/^[^:]+: .+$/);
      expect(nombre).not.toContain("·");
      expect(nombre.endsWith(`: ${nombreVersion(v)}`)).toBe(true);
    }
  });
});
