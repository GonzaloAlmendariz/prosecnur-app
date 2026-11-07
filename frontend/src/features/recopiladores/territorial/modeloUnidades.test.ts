import { describe, expect, it } from "vitest";

import { normalizarUnidadesTerritoriales, type UnidadTerritorial } from "../../../api/materialTerritorial";
import { agruparUnidades, coincide, contarVistas, fechaDelEnvio, filtrarUnidades, hayObservaciones, observacionDe, rangoDeLaUmp, unidadDelFoco } from "./modeloUnidades";
import type { EstadoUnidad } from "./revisionUnidades";

function u(parcial: Partial<UnidadTerritorial> & Pick<UnidadTerritorial, "unit_id" | "role">): UnidadTerritorial {
  return {
    label: parcial.unit_id, titular_id: null, distrito: "Lima", ubigeo: "150101", zona: "001", manzana: "01",
    rango_inicio: 1, rango_fin: 5, viviendas: 120, ...parcial,
  };
}

const UNIDADES: UnidadTerritorial[] = [
  u({ unit_id: "A1", role: "titular", label: "UMP 1" }),
  u({ unit_id: "B1", role: "titular", label: "UMP 2", distrito: "Breña", ubigeo: "150105", zona: "004" }),
  u({ unit_id: "A2", role: "titular", label: "UMP 3" }),
  u({ unit_id: "RA1", role: "reemplazo", label: "R 1", titular_id: "A1", zona: "009" }),
  u({ unit_id: "RX", role: "reemplazo", label: "R 2", titular_id: "ZZ" }),
];

describe("la lista de UMP de la campaña territorial", () => {
  it("agrupa por distrito con los reemplazos bajo su titular", () => {
    const g = agruparUnidades(UNIDADES);
    expect(g.map((x) => x.distrito)).toEqual(["Lima", "Breña"]);
    expect(g[0].titulares.map((t) => t.titular.unit_id)).toEqual(["A1", "A2"]);
    expect(g[0].titulares[0].reemplazos.map((r) => r.unit_id)).toEqual(["RA1"]);
    // El reemplazo de una titular ausente no se pierde.
    expect(g[0].sueltos.map((r) => r.unit_id)).toEqual(["RX"]);
  });

  it("busca sin acentos, por palabras, y entra por el reemplazo", () => {
    expect(agruparUnidades(UNIDADES, "brena").map((x) => x.distrito)).toEqual(["Breña"]);
    const porReemplazo = agruparUnidades(UNIDADES, "zona 009");
    expect(porReemplazo).toHaveLength(1);
    expect(porReemplazo[0].titulares[0].titular.unit_id).toBe("A1");
    expect(porReemplazo[0].titulares[0].reemplazos.map((r) => r.unit_id)).toEqual(["RA1"]);
    expect(agruparUnidades(UNIDADES, "nada que exista")).toEqual([]);
    expect(coincide(UNIDADES[0], "ump 1 lima")).toBe(true);
  });

  it("resuelve el foco, la fecha y el rango", () => {
    expect(unidadDelFoco(UNIDADES, "RA1")?.label).toBe("R 1");
    expect(unidadDelFoco(UNIDADES, "no")).toBeNull();
    expect(fechaDelEnvio("2026-10-29T15:00:00")).toBe("29/10/2026");
    expect(fechaDelEnvio("x")).toBeNull();
    expect(rangoDeLaUmp({ rango_inicio: 1, rango_fin: 5, viviendas: null })).toBe("encuestas 1–5");
  });
});

describe("normalizarUnidadesTerritoriales", () => {
  it("descarta lo que no reconoce y lee escalares de R", () => {
    const n = normalizarUnidadesTerritoriales({
      campaign_id: ["territorial.principal"], fase: "pilot", stale: [true], enviado_at: null,
      sample_fingerprint: "sha256:x",
      units: [
        { unit_id: "A1", role: "titular", label: "UMP 1", titular_id: null, rango_inicio: [1], viviendas: "120" },
        { unit_id: "A1", role: "titular" },
        { unit_id: "", role: "titular" },
        { unit_id: "Q", role: "otro" },
        { unit_id: "R1", role: "reemplazo", titular_id: "A1" },
      ],
    });
    expect(n.fase).toBe("pilot");
    expect(n.stale).toBe(true);
    expect(n.units.map((x) => x.unit_id)).toEqual(["A1", "R1"]);
    expect(n.units[0].viviendas).toBe(120);
    expect(n.units[1].titular_id).toBe("A1");
    expect(n.n_titulares).toBe(1);
    expect(n.n_reemplazos).toBe(1);
  });

  it("en cuotas las unidades son zonas: van a `zonas` con su cuota y no a `units`", () => {
    const n = normalizarUnidadesTerritoriales({
      campaign_id: "territorial.principal", fase: "field", kind: ["cuotas"], n_zonas: [2], n_entrevistas: [9],
      units: [
        { unit_id: "150103", role: "zona", label: "ATE", ubigeo: "150103", n: [5],
          cuotas: [{ sexo: "Mujer", rango_id: "r1", rango_edad: "18-29", n: [3] }, { sexo: "Hombre", rango_id: "r1", rango_edad: "18-29", n: 2 }] },
        { unit_id: "150103", role: "zona" },
        { unit_id: "150132", role: "zona", cuotas: { sexo: "Mujer", rango_id: "r1", rango_edad: "18-29", n: 4 } },
      ],
    });
    expect(n.kind).toBe("cuotas");
    expect(n.units).toEqual([]);
    expect(n.zonas.map((z) => z.id_zona)).toEqual(["150103", "150132"]);
    expect(n.zonas[0].nombre).toBe("ATE");
    expect(n.zonas[0].cuotas.map((c) => c.n)).toEqual([3, 2]);
    // Sin `n`, la zona suma sus cuotas; una cuota sola llega como objeto, no como lista.
    expect(n.zonas[1].n).toBe(4);
    expect(n.n_zonas).toBe(2);
    expect(n.n_entrevistas).toBe(9);
  });

  it("sin kind el envío es por UMP", () => {
    expect(normalizarUnidadesTerritoriales({ units: [] }).kind).toBe("ump");
  });

  it("una sola unidad serializada como objeto sigue siendo una lista", () => {
    expect(normalizarUnidadesTerritoriales({ units: { unit_id: "A1", role: "titular" } }).units).toHaveLength(1);
    expect(normalizarUnidadesTerritoriales({ units: {} }).units).toHaveLength(0);
  });
});

describe("las vistas de Unidades (revamp v5)", () => {
  const grupos = agruparUnidades(UNIDADES);
  const porRevisar = new Set(["A2"]);
  const encuestador = new Map([["A1", "E03"]]);

  it("«Por revisar» deja sólo las rutas con aviso, con sus reemplazos", () => {
    const g = filtrarUnidades(grupos, "por-revisar", null, porRevisar, encuestador);
    expect(g.flatMap((x) => x.titulares.map((t) => t.titular.unit_id))).toEqual(["A2"]);
    expect(g.flatMap((x) => x.sueltos)).toEqual([]);
  });

  it("«Sin encuestador» deja las titulares sin código en la asignación", () => {
    const g = filtrarUnidades(grupos, "sin-encuestador", null, porRevisar, encuestador);
    expect(g.flatMap((x) => x.titulares.map((t) => t.titular.unit_id))).toEqual(["A2", "B1"]);
  });

  it("el distrito acota y «Todas» conserva los reemplazos sueltos", () => {
    const g = filtrarUnidades(grupos, "todas", "150101", porRevisar, encuestador);
    expect(g.map((x) => x.clave)).toEqual(["150101"]);
    expect(g[0].sueltos.map((r) => r.unit_id)).toEqual(["RX"]);
  });

  it("cuenta titulares por vista", () => {
    expect(contarVistas(UNIDADES, porRevisar, encuestador)).toEqual({ "por-revisar": 1, "sin-encuestador": 2, todas: 3 });
  });
});

describe("la columna Observación (D15, C5)", () => {
  const ok: EstadoUnidad = { tono: "ok", motivo: null };
  const corta: EstadoUnidad = { tono: "aviso", motivo: "no alcanza" };
  it("una UMP en orden no lleva observación", () => {
    expect(observacionDe(ok)).toBeNull();
    expect(observacionDe(undefined)).toBeNull();
    expect(observacionDe(corta)).toEqual(corta);
  });
  it("se muestra sólo si alguna UMP de la campaña trae una", () => {
    expect(hayObservaciones(new Map([["A1", ok], ["B1", ok]]))).toBe(false);
    expect(hayObservaciones(new Map())).toBe(false);
    expect(hayObservaciones(new Map([["A1", ok], ["RA1", corta]]))).toBe(true);
  });
});
