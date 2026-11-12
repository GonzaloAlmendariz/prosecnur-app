import { describe, expect, it } from "vitest";
import type { CargaReviewPayload, CargaReviewReconciliationExtra } from "../../../../api/client";
import {
  cifrasDeRevision,
  comprobacionInicial,
  comprobacionesDeRevision,
  conteoPorDecision,
  estadoDeRevision,
  filtroInicial,
  hayCambiosPorGuardar,
  incluidasAlGuardar,
  marcadasIniciales,
  rotuloConDato,
  type EntradaDeRevision,
} from "./comprobacionesModel";

const extra = (name: string, cambios: Partial<CargaReviewReconciliationExtra> = {}): CargaReviewReconciliationExtra => ({
  name, fill_pct: 100, n_fill: 85, kind: "con_datos", incluida: false, decision: "pending", ...cambios,
});

function revision(cambios: Partial<CargaReviewPayload> = {}): CargaReviewPayload {
  return {
    ok: true,
    base_nombre: null,
    compatibility: { applied: true, ok: true, status: "ok", missing_columns: [], extra_columns: [], matched_columns: 34, expected_columns: 34, n_missing: 0, n_extra: 0, message: "" },
    choice_mapping: { status: "confirmed", pending: false, applied: false, requires_confirmation: false, n_questions: 0, maps: [] },
    reconciliation: { extra: [], n_extra: 0, n_incluidas: 0, n_excluidas: 0, n_pendientes: 0, reviewed: true },
    procedencia: null,
    orden_editor: null,
    fuentes: null,
    ready: true,
    ...cambios,
  };
}

const entrada = (cambios: Partial<EntradaDeRevision> = {}): EntradaDeRevision => ({
  revision: revision(),
  leyendo: false,
  tieneFormulario: true,
  tieneRespuestas: true,
  mapeoPendiente: false,
  filas: 85,
  conUniverso: true,
  conOrigenExterno: true,
  ...cambios,
});

const conPendientes = revision({
  ready: false,
  reconciliation: { extra: [extra("sede"), extra("Custom Data 1", { kind: "vacia", fill_pct: 0, n_fill: 0 })], n_extra: 2, n_incluidas: 0, n_excluidas: 0, n_pendientes: 2, reviewed: false },
  choice_mapping: { status: "pending", pending: true, applied: true, requires_confirmation: true, n_questions: 1, maps: [] },
});

describe("comprobaciones de Revisión", () => {
  it("sin pendientes: todas conformes, ninguna abierta y la cabecera dice que no hay nada por decidir", () => {
    const lista = comprobacionesDeRevision(entrada());
    expect(lista.map((c) => c.clave)).toEqual(["formulario", "respuestas", "columnas", "extra", "codigos", "universo", "origen-externo"]);
    expect(cifrasDeRevision(lista)).toEqual({ conformes: 5, total: 5 });
    expect(comprobacionInicial(lista)).toBeNull();
    expect(estadoDeRevision({ lista, leyendo: false, conInsumos: true, resumen: null })).toEqual({ tono: "listo", texto: "Sin pendientes" });
    expect(lista.find((c) => c.clave === "respuestas")?.detalle).toBe("85 filas");
  });

  it("con columnas y códigos por decidir: abre las columnas, cuenta lo que falta y pide decisión", () => {
    const lista = comprobacionesDeRevision(entrada({ revision: conPendientes }));
    const extraC = lista.find((c) => c.clave === "extra");
    expect(extraC).toMatchObject({ tono: "aviso", pendientes: 2, detalle: "2 columnas por decidir" });
    expect(lista.find((c) => c.clave === "codigos")).toMatchObject({ tono: "aviso", pendientes: 1, detalle: "1 pregunta con códigos por confirmar" });
    expect(comprobacionInicial(lista)).toBe("extra");
    expect(cifrasDeRevision(lista)).toEqual({ conformes: 3, total: 5 });
    expect(estadoDeRevision({ lista, leyendo: false, conInsumos: true, resumen: null })?.tono).toBe("atencion");
  });

  it("una base incompatible se abre antes que las decisiones y bloquea", () => {
    const r = revision({ compatibility: { ...revision().compatibility, ok: false, n_missing: 3, matched_columns: 31 }, reconciliation: conPendientes.reconciliation });
    const lista = comprobacionesDeRevision(entrada({ revision: r }));
    expect(lista.find((c) => c.clave === "columnas")).toMatchObject({ tono: "error", detalle: "Faltan 3 columnas del formulario" });
    expect(comprobacionInicial(lista)).toBe("columnas");
    expect(estadoDeRevision({ lista, leyendo: false, conInsumos: true, resumen: null })?.tono).toBe("bloqueado");
  });

  it("mientras lee no afirma nada del motor ni da estado de conformidad", () => {
    const lista = comprobacionesDeRevision(entrada({ revision: conPendientes, leyendo: true }));
    expect(lista.some((c) => c.clave === "extra" || c.clave === "codigos")).toBe(false);
    expect(estadoDeRevision({ lista, leyendo: true, conInsumos: true, resumen: null })).toEqual({ tono: "neutro", texto: "Revisando" });
  });

  it("sin insumos no hay estado y el formulario y las respuestas dicen qué falta", () => {
    const lista = comprobacionesDeRevision(entrada({ revision: null, tieneFormulario: false, tieneRespuestas: false, filas: null, conUniverso: false, conOrigenExterno: false }));
    expect(lista.map((c) => [c.clave, c.tono])).toEqual([["formulario", "error"], ["respuestas", "error"]]);
    expect(estadoDeRevision({ lista, leyendo: false, conInsumos: false, resumen: null })).toBeNull();
  });

  it("con varias bases, la base sin pendientes no da el estudio por listo", () => {
    const lista = comprobacionesDeRevision(entrada());
    const resumen = { bases: [], n_bases: 2, n_ready: 1, n_blocked: 1, all_ready: false };
    expect(estadoDeRevision({ lista, leyendo: false, conInsumos: true, resumen })?.tono).toBe("parcial");
  });
});

describe("columnas fuera del formulario", () => {
  const extras = [extra("a"), extra("b", { fill_pct: 40, n_fill: 34 }), extra("c", { decision: "exclude" })];

  it("marca de inicio las completas si no hay decisión, y las incorporadas si la hay", () => {
    expect(marcadasIniciales(extras)).toEqual(["a", "c"]);
    expect(marcadasIniciales([extra("a", { decision: "exclude" }), extra("b", { decision: "include", incluida: true })])).toEqual(["b"]);
  });

  it("guarda la lista de las que entran en el orden del motor; las demás quedan fuera", () => {
    expect(incluidasAlGuardar(extras, ["c", "a"])).toEqual(["a", "c"]);
    expect(incluidasAlGuardar(extras, ["zz"])).toEqual([]);
  });

  it("solo hay algo por guardar si queda una pendiente o la selección cambió", () => {
    const decididas = [extra("a", { decision: "include", incluida: true }), extra("b", { decision: "exclude" })];
    expect(hayCambiosPorGuardar(decididas, ["a"])).toBe(false);
    expect(hayCambiosPorGuardar(decididas, ["a", "b"])).toBe(true);
    expect(hayCambiosPorGuardar(extras, [])).toBe(true);
  });

  it("filtra por la decisión guardada y abre en lo que falta decidir", () => {
    expect(conteoPorDecision(extras)).toEqual({ pendiente: 2, include: 0, exclude: 1, todas: 3 });
    expect(filtroInicial(extras)).toBe("pendiente");
    expect(filtroInicial([extra("x", { decision: "include" })])).toBe("todas");
  });

  it("dice el dato con conteo y porcentaje juntos", () => {
    expect(rotuloConDato(extra("a", { n_fill: 34, fill_pct: 40 }))).toBe("34 (40 %)");
    expect(rotuloConDato(extra("a", { n_fill: 1, fill_pct: 0.4 }))).toBe("1 (menos de 1 %)");
    expect(rotuloConDato(extra("a", { kind: "vacia", n_fill: 0, fill_pct: 0 }))).toBe("Vacía");
  });
});
