// Versiones de un tipo de gráfico (ADR 0139, enmienda 2026-11-09): la tarjeta del tipo ofrece la base y cada variante;
// elegir una aplica sus args fijos y quita los suyos; volver a la base quita el estilo y la regla del resumen; la
// tarjeta muestra elegida la versión candidata, o la actual de la ranura, o la base.
import { describe, expect, it } from "vitest";
import { VARIANTES_GRAFICO } from "../../iconos/catalogoTipos.generated";
import { entradaDeGrafico, NOMBRE_TIPO_GRAFICO, nombreConVersion, nombreVersion, nombreVersionBase, varianteGrafico } from "../../catalogoGraficos";
import { esVersionDe, graficoDeVersion, versionesDeTipo, versionMostrada } from "./versionesGrafico";
import { compatibleGraficadorRef } from "../../GraficosLibrariesHost";
import type { GraficadorMetadata, GraficadorRef } from "../../../../api/graficos";

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

  it("cobertura (ADR 0140): por categorías fija el modo y quita lo de públicos; volver a «Por públicos» quita lo suyo", () => {
    const publicos = { graficador: "p_cobertura", args: { bases: ["estudiantes"], universos: "Estudiantes: 300", metas: "x", extras: [], universos_no_confiables: "y" } };
    expect(graficoDeVersion("p_cobertura:categorias", publicos).args).toEqual({ bases: ["estudiantes"], modo: "categorias" });
    const categorias = {
      graficador: "p_cobertura",
      args: { bases: ["estudiantes"], modo: "categorias", variable: "p6", universo_categorias: { estudiantes: {} }, tolerancia_pts: 3, estilo: "x" },
    };
    expect(graficoDeVersion("p_cobertura", categorias).args).toEqual({ bases: ["estudiantes"], estilo: "x" });
    expect(entradaDeGrafico("p_cobertura", categorias.args)).toBe("p_cobertura:categorias");
    expect(entradaDeGrafico("p_cobertura", publicos.args)).toBe("p_cobertura");
  });

  it("ronda 19 (F1): de «Por categorías» a «Por públicos» con el filtro del registro, que no declara `modo`", () => {
    const anterior: GraficadorRef = {
      graficador: "p_cobertura",
      args: { bases: ["estudiantes"], modo: "categorias", variable: "estudiantes$p6", universo_categorias: { estudiantes: {} }, tolerancia_pts: 3 },
    };
    // Lo que deja `compatibleGraficadorRef` con un registro que declara variable, universo y tolerancia, pero no `modo`.
    const meta = { name: "p_cobertura", args: ["bases", "variable", "universo_categorias", "tolerancia_pts"].map((name) => ({ name })) };
    const filtrado = compatibleGraficadorRef(meta as unknown as GraficadorMetadata, anterior);
    expect(filtrado.args).not.toHaveProperty("modo");
    const args = graficoDeVersion("p_cobertura", filtrado, anterior).args ?? {};
    expect(args).toEqual({ bases: ["estudiantes"] });
    for (const k of ["variable", "universo_categorias", "tolerancia_pts", "modo"]) expect(args).not.toHaveProperty(k);
  });

  it("la base sobre un gráfico que no es variante no toca sus args", () => {
    const base = { graficador: "p_barras_divergentes", args: { vars: ["p2"], estilo: "recetario" } };
    expect(graficoDeVersion("p_barras_divergentes", base)).toBe(base);
  });
});

describe("nombre con versión (selector, maqueta, aviso, inspector y Estructura)", () => {
  it("ronda 19 (O3): «<tipo>, versión <versión>», sin dos puntos ni punto medio", () => {
    for (const v of VARIANTES_GRAFICO) {
      const nombre = nombreConVersion(v);
      expect(nombre).not.toContain(":");
      expect(nombre).not.toContain("·");
      expect(nombre.endsWith(`, versión ${nombreVersion(v)}`)).toBe(true);
      expect(`Hoy: ${nombre}.`.split(":").length).toBe(2);
    }
    const contraste = varianteGrafico("p_dumbbell:contraste");
    if (!contraste) throw new Error("falta la variante");
    // El nombre del tipo, del catálogo (ronda 21: no un literal que un renombre deja atrás).
    const tipo = NOMBRE_TIPO_GRAFICO.p_dumbbell;
    expect(tipo).toBeTruthy();
    expect(nombreConVersion(contraste, tipo)).toBe(`${tipo}, versión ${nombreVersion(contraste)}`);
    expect(nombreConVersion(contraste)).toBe(nombreConVersion(contraste, tipo));
  });
});
