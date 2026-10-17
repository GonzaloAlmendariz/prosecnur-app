import { describe, expect, it } from "vitest";

import { normalizeMaterialCatalog, type MaterialCatalogPayload } from "../../../api/materialCatalog";
import { ESTADO_INICIAL_CATALOGO, catalogoVisible, reducirCatalogo, type EstadoCatalogo } from "./estadoCatalogo";

function catalogo(presets: Array<Record<string, unknown>>): MaterialCatalogPayload {
  return normalizeMaterialCatalog({ schema: "collection_material_catalog/v1", presets });
}

const DOS = catalogo([
  { preset_id: "ficha", family: "unidad", active: true },
  { preset_id: "afiche", family: "participante" },
]);

function listo(c = DOS): EstadoCatalogo {
  return reducirCatalogo(ESTADO_INICIAL_CATALOGO, { type: "carga-ok", catalogo: c });
}

describe("reducirCatalogo", () => {
  it("al llegar el catálogo selecciona el tipo en uso", () => {
    const e = listo();
    expect(e.carga.estado).toBe("listo");
    expect(e.seleccion).toBe("ficha");
  });

  it("recargar no vacía la galería", () => {
    const e = reducirCatalogo(listo(), { type: "carga-inicio" });
    expect(e.carga.estado).toBe("cargando");
    expect(catalogoVisible(e.carga)?.presets).toHaveLength(2);
  });

  it("un catálogo nuevo sin la selección ni la familia vuelve a un estado válido", () => {
    let e = reducirCatalogo(listo(), { type: "familia", familia: "participante" });
    expect(e.seleccion).toBe("afiche");
    e = reducirCatalogo(e, { type: "carga-ok", catalogo: catalogo([{ preset_id: "otro", family: "unidad" }]) });
    expect(e.familia).toBe("todos");
    expect(e.seleccion).toBe("otro");
  });

  it("cambiar de familia conserva la selección si sigue visible", () => {
    const e = reducirCatalogo(listo(), { type: "familia", familia: "unidad" });
    expect(e.seleccion).toBe("ficha");
  });

  it("guarda cada vista por clave y su error", () => {
    let e = reducirCatalogo(listo(), { type: "vista-inicio", clave: "ficha#1" });
    expect(e.vistas["ficha#1"]).toEqual({ estado: "cargando" });
    e = reducirCatalogo(e, { type: "vista-error", clave: "ficha#1", mensaje: "x" });
    expect(e.vistas["ficha#1"]).toEqual({ estado: "error", mensaje: "x" });
  });

  it("usar: marca el tipo en curso y limpia o deja el error", () => {
    let e = reducirCatalogo(listo(), { type: "usar-inicio", presetId: "afiche" });
    expect(e.usando).toBe("afiche");
    e = reducirCatalogo(e, { type: "usar-fin", error: "No se pudo" });
    expect(e).toMatchObject({ usando: null, errorAccion: "No se pudo" });
    e = reducirCatalogo(e, { type: "seleccionar", presetId: "ficha" });
    expect(e.errorAccion).toBe("");
  });

  it("un error de carga no deja catálogo visible", () => {
    const e = reducirCatalogo(listo(), { type: "carga-error", mensaje: "caído" });
    expect(catalogoVisible(e.carga)).toBeNull();
  });
});
