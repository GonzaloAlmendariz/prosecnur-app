import { describe, expect, it } from "vitest";
import { cortesDePestana, scopesDePestana } from "./cortesDePestana";

describe("cortesDePestana", () => {
  it("Equipo pide consultas y validación", () => {
    expect(scopesDePestana({ seccion: "control", pestana: "equipo", panel: null })).toEqual(["queries_summary", "validation_summary"]);
  });
  it("Conexiones pide avance y consultas", () => {
    expect(cortesDePestana({ seccion: "insumos", pestana: "conexiones", panel: null })).toEqual(["avance", "consultas"]);
  });
  it("Metas pide el corte de ruta (con las manzanas) y el de avance", () => {
    expect(scopesDePestana({ seccion: "modelo", pestana: "metas", panel: null })).toEqual(["route_summary", "advance_summary"]);
  });
  it("una vista heredada no pide cortes extra", () => {
    expect(cortesDePestana({ seccion: "avance", pestana: "resumen", panel: "ritmo" })).toEqual([]);
  });
  it("Faltante pide avance: el último corte aplicado puede ser el de validación, sin subsanaciones", () => {
    expect(cortesDePestana({ seccion: "avance", pestana: "faltante", panel: null })).toEqual(["avance"]);
  });
});
