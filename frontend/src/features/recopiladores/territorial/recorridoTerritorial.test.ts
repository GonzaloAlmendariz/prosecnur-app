import { describe, expect, it } from "vitest";

import type { AsignacionTerritorial, UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { recorridoTerritorial } from "./recorridoTerritorial";

const base = { campaign_id: "territorial.principal", zonas: [], n_zonas: 0, n_entrevistas: 0, fase: "campo", units: [], n_titulares: 3, n_reemplazos: 3, enviado_at: null, sample_fingerprint: "x", stale: false } as unknown as UnidadesTerritoriales;
const ump = { ...base, kind: "ump" } as UnidadesTerritoriales;
const cuotas = { ...base, kind: "cuotas", n_zonas: 2 } as UnidadesTerritoriales;

function asig(filas: { id: string; role: "titular" | "reemplazo"; codigo: string }[]): AsignacionTerritorial {
  return { asignacion: filas.map((f) => ({ id_manzana: f.id, label: f.id, role: f.role, codigo: f.codigo, origen: "explicita" })) } as unknown as AsignacionTerritorial;
}

describe("recorrido de la campaña territorial", () => {
  it("cuenta las rutas por revisar y las titulares sin encuestador", () => {
    const r = recorridoTerritorial(ump, [{ clave: "a", distrito: "Ate", titulares: 3, reemplazos: 3, porRevisar: 2 }], asig([
      { id: "u1", role: "titular", codigo: "E03" },
      { id: "u2", role: "titular", codigo: "" },
      { id: "r1", role: "reemplazo", codigo: "E03" },
    ]));
    expect(r).toEqual({ porRevisar: 2, total: 3, asignadas: 1, sinAsignar: 2 });
  });

  it("en cuotas cuenta zonas y no habla de rutas por revisar", () => {
    const r = recorridoTerritorial(cuotas, [{ clave: "a", distrito: "Ate", titulares: 0, reemplazos: 0, porRevisar: 5 }], asig([
      { id: "150103", role: "titular", codigo: "E03" },
      { id: "150103", role: "titular", codigo: "E04" },
    ]));
    expect(r).toEqual({ porRevisar: 0, total: 2, asignadas: 1, sinAsignar: 1 });
  });

  it("sin muestra no inventa pendientes", () => {
    expect(recorridoTerritorial(null, [], null)).toEqual({ porRevisar: 0, total: 0, asignadas: 0, sinAsignar: 0 });
  });
});
