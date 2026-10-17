/**
 * H26 — rehacer el plan pide confirmación con cifras y no escribe sin ella.
 *
 * Antes, «Rehacer el plan con el sorteo vigente» llamaba al reseed al pulsar y
 * nunca leía `descartado`: el analista perdía fichas, recibos y publicaciones
 * sin ver cuántas. Cifras de hsvg2026_con_plan_v2.pulso: 1 juego de fichas que
 * cubre 2.373 unidades y 1 recibo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { CollectionReseedDescartado, CollectionStatePayload } from "../../api/recopiladores";
import { ApiError } from "../../api/core";
import { PANELES_POR_MODULO } from "../../lib/navegacion/manifiesto";
import {
  AVISO_PLAN_ACTUALIZADO,
  confirmarResembrado,
  leerPreviaDelResembrado,
  mensajeDeErrorDelResembrado,
  PANEL_REHACER_PLAN,
  rotulosConservados,
  textoDelResembrado,
  type PuertoDelResembrado,
} from "./resembrado";

const HSVG: CollectionReseedDescartado = {
  plan_run_id: "sel_aulas_20260801211224_e32c240d",
  unidades: 2373,
  tenia_despliegue: true,
  entregado: false,
  fichas: { instancias: 1, unidades_cubiertas: 2373 },
  recibos: 1,
  publicaciones_drive: 0,
  otros_campos: [],
  conservado: ["material_template", "mail_template", "pruebas", "drive_fichas"],
};

const NADA: CollectionReseedDescartado = {
  ...HSVG,
  unidades: 0,
  tenia_despliegue: false,
  fichas: { instancias: 0, unidades_cubiertas: 0 },
  recibos: 0,
  conservado: [],
};

describe("texto del diálogo", () => {
  it("dice qué entra y qué sale con su cifra y su sorteo", () => {
    const t = textoDelResembrado(HSVG, { plan_run_id: "sel_aulas_20260821160928_bf10d14c", unidades: 2400 });
    expect(t.entra).toBe(`Entra el plan del sorteo del 21 ago 2026, 16:09: ${(2400).toLocaleString("es-PE")} unidades.`);
    expect(t.sale).toContain("1 ago 2026");
    expect(t.sale).toContain((2373).toLocaleString("es-PE"));
  });

  it("cuenta lo que se descarta, en singular cuando es uno", () => {
    const t = textoDelResembrado(HSVG, { plan_run_id: "", unidades: 10 });
    expect(t.descarta).toEqual([
      `1 juego de fichas generado (${(2373).toLocaleString("es-PE")} unidades)`,
      "1 archivo registrado",
      "El despliegue preparado",
    ]);
  });

  it("la entrega a campo se dice aparte, y las publicaciones avisan que Drive se queda", () => {
    const t = textoDelResembrado(
      { ...HSVG, entregado: true, publicaciones_drive: 3, recibos: 4, otros_campos: ["a", "b"] },
      null,
    );
    expect(t.descarta).toContain("El despliegue y su entrega a campo");
    expect(t.descarta).not.toContain("El despliegue preparado");
    expect(t.descarta).toContain("4 archivos registrados");
    expect(t.descarta).toContain("3 publicaciones en Drive (los archivos se quedan en Drive)");
    expect(t.descarta).toContain("2 datos más del módulo");
  });

  it("sin nada que descartar igual dice lo que entra", () => {
    const t = textoDelResembrado(NADA, { plan_run_id: "run-1", unidades: 1 });
    expect(t.descarta).toEqual([]);
    expect(t.entra).toBe("Entra el plan: 1 unidad.");
    expect(t.sale).toBe("");
  });

  it("lo conservado sale con rótulos humanos, nunca con la clave", () => {
    const t = textoDelResembrado(HSVG, null);
    expect(t.conserva).toEqual([
      "Plantilla de la ficha", "Plantilla del correo", "Fichas de prueba", "Carpeta de Drive",
    ]);
    for (const rotulo of t.conserva) expect(rotulo).not.toMatch(/_/);
    expect(rotulosConservados(["clave_nueva", "otra_nueva"])).toEqual(["Otra configuración"]);
  });

  it("sin previsualización no inventa cifras", () => {
    const t = textoDelResembrado(null, null);
    expect(t.entra).toBe("Entra el plan del sorteo vigente.");
    expect(t.descarta).toEqual([]);
    expect(t.conserva).toEqual([]);
  });
});

describe("errores", () => {
  it("un 409 por revisión vieja dice qué hacer, sin el código", () => {
    const m = mensajeDeErrorDelResembrado(new ApiError("E_COLLECTION_STATE_STALE", "cambió"), "rehacer");
    expect(m).not.toContain("E_COLLECTION");
    expect(m).toContain("cambió mientras lo revisabas");
  });

  it("un 409 sin selección vigente lo dice en castellano", () => {
    const m = mensajeDeErrorDelResembrado(new ApiError("E_COLLECTION_SIN_ORIGEN", "x"), "leer");
    expect(m).toBe("No hay una selección de aulas vigente de la que rehacer el plan.");
  });
});

function payload(revision: number): CollectionStatePayload {
  const state = { schema: "collection_state/v1" as const, state_revision: revision, plan: null, deployment: null };
  return { ok: true, seed_available: false, ...state, state, descartado: HSVG, propuesto: { plan_run_id: "", unidades: 5 } };
}

function puerto(over: Partial<PuertoDelResembrado> = {}) {
  return {
    previsualizar: vi.fn(async (rev: number) => payload(rev)),
    rehacer: vi.fn(async (rev: number) => payload(rev + 1)),
    leerVigente: vi.fn(async () => payload(9)),
    ...over,
  } satisfies PuertoDelResembrado;
}

describe("flujo: abrir sólo previsualiza", () => {
  it("leer la previa no dispara el reseed real", async () => {
    const p = puerto();
    const r = await leerPreviaDelResembrado(p, 4);
    expect(p.previsualizar).toHaveBeenCalledWith(4);
    expect(p.rehacer).not.toHaveBeenCalled();
    expect(r).toEqual({
      tipo: "listo",
      previa: { revision: 4, descartado: HSVG, propuesto: { plan_run_id: "", unidades: 5 } },
    });
  });

  it("confirmar escribe con la MISMA revisión que se previsualizó", async () => {
    const p = puerto();
    const r = await leerPreviaDelResembrado(p, 4);
    if (r.tipo !== "listo") throw new Error("se esperaba la previa");
    const hecho = await confirmarResembrado(p, r.previa);
    expect(p.rehacer).toHaveBeenCalledTimes(1);
    expect(p.rehacer).toHaveBeenCalledWith(4);
    expect(hecho.tipo).toBe("hecho");
  });

  it("un 409 al confirmar repinta con el estado vigente y no reintenta solo", async () => {
    const p = puerto({
      rehacer: vi.fn(async () => { throw new ApiError("E_COLLECTION_STATE_STALE", "cambió"); }),
    });
    const r = await confirmarResembrado(p, { revision: 4, descartado: HSVG, propuesto: null });
    expect(r).toEqual({ tipo: "refrescado", payload: payload(9) });
    expect(p.rehacer).toHaveBeenCalledTimes(1);
    expect(AVISO_PLAN_ACTUALIZADO).toContain("revísalo antes de confirmar");
  });

  it("un 409 sin estado nuevo que traer se enseña como error", async () => {
    const p = puerto({
      previsualizar: vi.fn(async () => { throw new ApiError("E_COLLECTION_STATE_STALE", "cambió"); }),
      leerVigente: vi.fn(async () => payload(4)),
    });
    const r = await leerPreviaDelResembrado(p, 4);
    expect(r.tipo).toBe("error");
  });
});

describe("el diálogo es un panel direccionable y el botón no escribe", () => {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const leer = (archivo: string) => fs.readFileSync(path.join(aqui, archivo), "utf8");

  it("está declarado en el manifiesto de Material de campo", () => {
    expect(PANELES_POR_MODULO["material-campo"]).toContainEqual(PANEL_REHACER_PLAN);
    expect(PANEL_REHACER_PLAN.clase).toBe("dialogo");
  });

  it("la acción vive sólo en Origen (E1e): la Lista enlaza, Origen abre el panel", () => {
    const lista = leer("PlanSection.tsx");
    expect(lista).not.toMatch(/apiRecopiladoresReseed/);
    expect(lista).not.toMatch(/PANEL_REHACER_PLAN|ConfirmarResembrado/);
    expect(lista).toMatch(/DIRECCION_ORIGEN/);
    const origen = leer("OrigenSection.tsx");
    expect(origen).not.toMatch(/apiRecopiladoresReseed/);
    expect(origen).toMatch(/usePanelDireccionable\(PANEL_REHACER_PLAN\)/);
    expect(origen).toMatch(/onActualizar=\{panel\.abrir\}/);
    expect(origen).toMatch(/expectedSourceFingerprint=\{origen\.fingerprint_actual\}/);
  });

  it("el diálogo sólo escribe desde confirmar", () => {
    const fuente = leer("ConfirmarResembrado.tsx");
    expect(fuente).toMatch(/usePanelDireccionable|panel: ControlPanel/);
    const usos = fuente.match(/confirmarResembrado\(PUERTO/g) ?? [];
    expect(usos).toHaveLength(1);
    expect(fuente.indexOf("confirmarResembrado(PUERTO")).toBeGreaterThan(fuente.indexOf("const confirmar = async"));
  });
});

describe("actualizar desde la fuente (E1e)", () => {
  const CONTEO = { altas: 2, bajas: 0, campos: 1, roles: 0 };

  it("titula y confirma como «Actualizar desde la fuente» y da el conteo", () => {
    const t = textoDelResembrado(HSVG, { plan_run_id: "sel_aulas_20260821160928_x", unidades: 2470, diferencias: CONTEO }, "actualizar");
    expect(t.titulo).toBe("¿Actualizar desde la fuente?");
    expect(t.confirmar).toBe("Actualizar desde la fuente");
    expect(t.diferencias).toBe("Entran 2, salen 0, cambian 1.");
  });

  it("«cambian» son los datos; el rol no se cuenta dos veces", () => {
    const t = textoDelResembrado(HSVG, { plan_run_id: "", unidades: 5, diferencias: { ...CONTEO, roles: 1, unidades_con_cambios: 2 } }, "actualizar");
    expect(t.diferencias).toBe("Entran 2, salen 0, cambian 1, 1 de rol.");
  });

  it("sin conteo del backend no inventa uno", () => {
    const t = textoDelResembrado(HSVG, { plan_run_id: "", unidades: 5 }, "actualizar");
    expect(t.diferencias).toBe("");
  });

  it("previsualiza y escribe con la MISMA huella que se revisó", async () => {
    const p = puerto({});
    const r = await leerPreviaDelResembrado(p, 4, "sha256:abc");
    expect(p.previsualizar).toHaveBeenCalledWith(4, "sha256:abc");
    if (r.tipo !== "listo") throw new Error("debía quedar lista");
    expect(r.previa.huella).toBe("sha256:abc");
    await confirmarResembrado(p, r.previa);
    expect(p.rehacer).toHaveBeenCalledWith(4, "sha256:abc");
  });

  it("un 409 de origen pide releer la fuente, no escribir", async () => {
    const cambio = () => { throw new ApiError("E_COLLECTION_ORIGEN_CAMBIO", "La fuente cambió"); };
    const p = puerto({
      previsualizar: vi.fn(async () => cambio()),
      rehacer: vi.fn(async () => cambio()),
    });
    expect((await leerPreviaDelResembrado(p, 4, "sha256:abc")).tipo).toBe("fuente-cambio");
    expect((await confirmarResembrado(p, { revision: 4, huella: "sha256:abc", descartado: HSVG, propuesto: null })).tipo)
      .toBe("fuente-cambio");
    expect(p.leerVigente).not.toHaveBeenCalled();
  });

  it("el 409 de origen se dice en castellano", () => {
    const m = mensajeDeErrorDelResembrado(new ApiError("E_COLLECTION_ORIGEN_CAMBIO", "x"), "rehacer");
    expect(m).toContain("La fuente cambió mientras revisabas las diferencias");
  });
});
