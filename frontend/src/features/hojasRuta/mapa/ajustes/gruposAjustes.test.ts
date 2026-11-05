import { describe, expect, it } from "vitest";
import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { esGrupoAjustes, filtrarGrupos, GRUPOS_AJUSTES, resumenGrupo } from "./gruposAjustes";

const config = {
  n_objetivo: 1200, entrevistas_por_manzana: 8, sample_size: { margin_total: 0.03, estrato: "provincia", base_reparto: null, rutas_minimas_ciudad: 6 },
  age_ranges: [{}, {}, {}, {}], subquota_var: "sexo", marco_elegible: { declarado: true, minimo_viviendas: 8, areas_excluidas: [{}, {}] },
  sampling_method: "pps", seed: 2017, replacements_per_titular: 1, territorios: [],
} as unknown as HojasRutaIntegratedConfig;

describe("grupos de Ajustes del diseño", () => {
  it("son los ocho de la maqueta, en su orden", () => {
    expect(GRUPOS_AJUSTES.map((g) => g.nombre)).toEqual(["Tamaño y precisión", "Reparto y estrato", "Visitas mínimas", "Cuotas y edades", "Marco elegible", "Sorteo de manzanas", "Recorrido y reemplazos", "Fase y piloto"]);
    expect(esGrupoAjustes("sorteo")).toBe(true);
    expect(esGrupoAjustes("lima")).toBe(false);
  });
  it("el buscador encuentra por palabra clave, sin tildes", () => {
    expect(filtrarGrupos("semilla").map((g) => g.id)).toEqual(["sorteo"]);
    expect(filtrarGrupos("asignacion").map((g) => g.id)).toEqual(["reparto"]);
    expect(filtrarGrupos("")).toHaveLength(8);
  });
  it("cada resumen dice el valor vigente, sin punto medio", () => {
    expect(resumenGrupo("tamano", config, { n: 1200 })).toBe("1,200 encuestas, 8 por ruta");
    expect(resumenGrupo("reparto", config)).toBe("Por provincia, CPV 2017");
    expect(resumenGrupo("marco", config)).toBe("Mínimo 8 viviendas, 2 áreas excluidas");
    expect(resumenGrupo("sorteo", config)).toBe("PPS estratificado, semilla 2017");
    expect(resumenGrupo("fase", config, { fase: "pilot" })).toBe("Piloto");
    expect(resumenGrupo("visitas", config)).toBe("6 rutas por ciudad como mínimo");
    expect(resumenGrupo("visitas", { ...config, sample_size: { ...config.sample_size, estrato: "distrito" } } as HojasRutaIntegratedConfig)).toBe("Sin efecto con estrato por distrito");
    for (const g of GRUPOS_AJUSTES) expect(resumenGrupo(g.id, config)).not.toContain("·");
  });
});
