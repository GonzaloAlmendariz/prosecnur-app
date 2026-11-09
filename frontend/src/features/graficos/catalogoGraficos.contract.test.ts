// ADR 0139, decisión 4: los espejos del catálogo en el frontend salen del JSON y no de listas escritas a mano. Cada uno
// se compara con api/inst/catalogos/graficos_tipos.json: nombres legibles, familias del selector, ranuras por tipo de
// lámina y variantes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { graficadorDisplayName, graficadorKindLabel } from "./graficadorDisplay";
import { FAMILIAS_GRAFICO } from "./laminas/selectores/tiposGrafico";
import { SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "./store";
import {
  argsDeEntrada, aplicarVariante, entradaDeGrafico, existeEntradaCatalogo, nombreDeEntrada, varianteDeGrafico, varianteGrafico,
} from "./catalogoGraficos";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
type Catalogo = {
  slides: Array<{ name: string; ranuras: Array<{ name: string; role: string }> }>;
  graficadores: Array<{ name: string; titulo_humano: string }>;
  familias_editor: Array<{ id: string; label: string }>;
  variantes: Array<{ id: string; nombre: string }>;
};
const catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, "api/inst/catalogos/graficos_tipos.json"), "utf8")) as Catalogo;

describe("espejo de los nombres legibles (graficadorDisplay)", () => {
  it("cada tipo de gráfico del catálogo se nombra con su titulo_humano", () => {
    for (const g of catalogo.graficadores) {
      expect(graficadorDisplayName(g.name)).toBe(g.titulo_humano);
      expect(graficadorKindLabel(g.name)).toBe(g.titulo_humano);
    }
  });

  it("no quedan nombres de tipos que el catálogo no tiene", () => {
    expect(graficadorDisplayName("p_radar_tabla")).toBe("Radar Tabla");
    expect(graficadorDisplayName("p_barras")).toBe("Barras");
  });
});

describe("espejo de las familias del selector", () => {
  it("id y nombre de cada familia, en el orden del catálogo", () => {
    expect(FAMILIAS_GRAFICO.map((f) => ({ id: f.id, label: f.label }))).toEqual(catalogo.familias_editor);
  });
});

describe("espejo de las ranuras de gráfico por tipo de lámina (SLIDE_GRAF_SLOTS)", () => {
  it("las ranuras chart de cada lámina, en su orden", () => {
    const esperado = Object.fromEntries(catalogo.slides.map((s) => [s.name, s.ranuras.filter((r) => r.role === "chart").map((r) => r.name)]));
    expect(SLIDE_GRAF_SLOTS).toEqual(esperado);
  });

  it("cubre todos los tipos de lámina de la app", () => {
    expect(Object.keys(SLIDE_GRAF_SLOTS).sort()).toEqual(Object.keys(SLIDE_LABELS).sort());
  });
});

describe("variantes del catálogo de gráficos", () => {
  it("cada variante se nombra como en el catálogo y existe como entrada", () => {
    for (const v of catalogo.variantes) {
      expect(nombreDeEntrada(v.id)).toBe(v.nombre);
      expect(existeEntradaCatalogo(v.id)).toBe(true);
    }
    expect(existeEntradaCatalogo("p_dumbbell:inexistente")).toBe(false);
  });

  it("reconoce la variante de un gráfico guardado como .graficos_variante_de", () => {
    expect(varianteDeGrafico("p_dumbbell", { estilo: "resumen", cruce: null })?.id).toBe("p_dumbbell:contraste");
    // El `null` vuelve del backend como `{}` (jsonlite): sigue siendo el contraste, no las aperturas (ronda 18).
    expect(varianteDeGrafico("p_dumbbell", { estilo: "resumen", cruce: {} })?.id).toBe("p_dumbbell:contraste");
    expect(varianteDeGrafico("p_dumbbell", { estilo: "resumen", cruce: "sexo" })?.id).toBe("p_dumbbell:aperturas");
    expect(varianteDeGrafico("p_dumbbell", { estilo: "resumen", vars: { docentes: ["p1"], alumnos: ["p1"] } })?.id).toBe("p_dumbbell:contraste");
    expect(varianteDeGrafico("p_dumbbell", { estilo: "resumen", vars: ["p1"] })?.id).toBe("p_dumbbell:aperturas");
    expect(varianteDeGrafico("p_dumbbell", { estilo: "recetario", cruce: null })).toBeNull();
    expect(varianteDeGrafico("p_barras_divergentes", { estilo: "resumen" })?.id).toBe("p_barras_divergentes:escala_sin_informacion");
    expect(varianteDeGrafico("p_barras_divergentes", {})).toBeNull();
    // ADR 0140: la cobertura se reconoce por su `modo`, antes que por el estilo (como en R).
    expect(varianteDeGrafico("p_cobertura", { modo: "categorias" })?.id).toBe("p_cobertura:categorias");
    expect(varianteDeGrafico("p_cobertura", { modo: "categorias", estilo: "resumen" })?.id).toBe("p_cobertura:categorias");
    expect(varianteDeGrafico("p_cobertura", { estilo: "resumen" })).toBeNull();
    expect(varianteDeGrafico("p_cobertura", {})).toBeNull();
    expect(entradaDeGrafico("p_pie", {})).toBe("p_pie");
  });

  it("aplicar una variante escribe sus args fijos y borra los que quita", () => {
    const aperturas = varianteGrafico("p_dumbbell:aperturas");
    expect(aperturas).not.toBeNull();
    if (!aperturas) return;
    expect(aplicarVariante({ cruce: null, bases: ["a", "b"], vars: ["p1"] }, aperturas)).toEqual({ estilo: "resumen", vars: ["p1"] });
    expect(argsDeEntrada("p_dumbbell:contraste")).toEqual({ estilo: "resumen", cruce: null });
    expect(argsDeEntrada("p_pie")).toEqual({});
  });
});
