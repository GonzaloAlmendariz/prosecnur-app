import { describe, expect, it } from "vitest";
import { normalizeGraficosRegistry } from "./metadataSanitizers";
import { detalleRetiro, esTipoRetirado, fichaRetirado, reemplazoDirecto, textoReemplazo, TIPOS_RETIRADOS_0137 } from "./retirados";

const REGISTRO = normalizeGraficosRegistry({
  slides: [],
  graficadores: [{ name: "p_media_rango", titulo_humano: "Media y rango" }, { name: "p_tabla", titulo_humano: "Tabla" }],
  retirados: [
    { name: "p_dim_radar", titulo_humano: "Radar por dimensiones", adr: "0137",
      reemplazo: { texto: "Media y rango sobre la columna del índice", graficador: "p_media_rango" } },
    { name: "p_significancia_publicos", titulo_humano: "Diferencias significativas entre públicos", adr: "0137",
      reemplazo: { texto: "las tarjetas de diferencias de un gráfico con cruce", graficador: "" } },
  ],
});

describe("normalizador de `retirados` del registro (ADR 0137)", () => {
  it("un backend anterior sin el campo deja un arreglo vacío", () => {
    expect(normalizeGraficosRegistry({ slides: [], graficadores: [] }).retirados).toEqual([]);
    expect(normalizeGraficosRegistry({ retirados: "x" }).retirados).toEqual([]);
    expect(normalizeGraficosRegistry(null).retirados).toEqual([]);
  });

  it("descarta fichas sin nombre o repetidas y completa lo que falte", () => {
    const r = normalizeGraficosRegistry({ retirados: [{ titulo_humano: "Sin nombre" }, { name: "p_dim_foda" }, { name: "p_dim_foda", titulo_humano: "Otra" }, 3] });
    expect(r.retirados).toEqual([{ name: "p_dim_foda", titulo_humano: "p_dim_foda", adr: "", reemplazo: { texto: "", graficador: "" } }]);
  });
});

describe("tipos retirados", () => {
  it("la lista congelada tiene los siete del ADR y basta sin registro", () => {
    expect(TIPOS_RETIRADOS_0137.size).toBe(7);
    expect(esTipoRetirado("p_dim_heatmap")).toBe(true);
    expect(esTipoRetirado("p_heatmap_cruce", REGISTRO)).toBe(false);
    expect(esTipoRetirado("p_tipo_nuevo", { retirados: [{ name: "p_tipo_nuevo", titulo_humano: "N", adr: "", reemplazo: { texto: "", graficador: "" } }] })).toBe(true);
  });

  it("la ficha sale del registro y, sin él, con el nombre legible y sin reemplazo", () => {
    expect(fichaRetirado("p_dim_radar", REGISTRO)?.reemplazo.graficador).toBe("p_media_rango");
    expect(fichaRetirado("p_dim_heatmap_criterios", null)).toEqual({
      name: "p_dim_heatmap_criterios", titulo_humano: "Mapa de calor por criterios", adr: "0137", reemplazo: { texto: "", graficador: "" },
    });
    expect(fichaRetirado("p_pie", REGISTRO)).toBeNull();
  });

  it("el reemplazo se escribe con mayúscula y punto; el ADR sólo va en el detalle", () => {
    expect(textoReemplazo(fichaRetirado("p_significancia_publicos", REGISTRO)!)).toBe("Reemplazo: Las tarjetas de diferencias de un gráfico con cruce.");
    expect(textoReemplazo({ reemplazo: { texto: "", graficador: "" } })).toBeNull();
    expect(detalleRetiro({ adr: "0137" })).toMatch(/ADR 0137/);
    expect(textoReemplazo(fichaRetirado("p_dim_radar", REGISTRO)!)).not.toMatch(/ADR|0137/);
  });

  it("el cambio directo sólo se ofrece con un graficador del registro que no esté retirado", () => {
    const porId = Object.fromEntries(REGISTRO.graficadores.map((g) => [g.name, g]));
    expect(reemplazoDirecto(fichaRetirado("p_dim_radar", REGISTRO)!, porId)).toEqual({ graficador: "p_media_rango", nombre: "Media y rango" });
    expect(reemplazoDirecto(fichaRetirado("p_significancia_publicos", REGISTRO)!, porId)).toBeNull();
    expect(reemplazoDirecto({ reemplazo: { texto: "x", graficador: "p_media_rango" } }, {})).toBeNull();
    expect(reemplazoDirecto({ reemplazo: { texto: "x", graficador: "p_dim_foda" } }, { p_dim_foda: { name: "p_dim_foda", titulo_humano: "F" } })).toBeNull();
  });
});

describe("enSelector", () => {
  it("el selector anterior tampoco ofrece los retirados del ADR 0137", async () => {
    const { enSelector } = await import("./enSelector");
    const items = [{ name: "p_pie" }, { name: "p_dim_radar", en_selector: true }, { name: "p_dim_foda", en_selector: false }, { name: "p_heatmap_cruce" }];
    expect(enSelector(items).map((x) => x.name)).toEqual(["p_pie", "p_heatmap_cruce"]);
  });
});
