import { describe, expect, it } from "vitest";
import type { GraficosShareInspectResult } from "../../../api/graficos";
import type { ImportacionJsonPreparada } from "./accionesCompartir";
import { compartirReducer, ESTADO_COMPARTIR_INICIAL } from "./compartirReducer";
import { todasLasSecciones } from "./seccionesJson";

const prep: ImportacionJsonPreparada = {
  nombreArchivo: "a.json", entrante: {}, secciones: todasLasSecciones(true), seccionIds: ["plan"], modo: "replace",
};

describe("estado de compartir", () => {
  it("una importación preparada queda pendiente hasta confirmar o cancelar", () => {
    const s1 = compartirReducer(ESTADO_COMPARTIR_INICIAL, { tipo: "importacion-preparada", prep });
    expect(s1.importacionPendiente).toBe(prep);
    expect(compartirReducer(s1, { tipo: "cancelar-confirmacion" }).importacionPendiente).toBeNull();
    expect(compartirReducer(s1, { tipo: "importacion-aplicada", mensaje: "ok" })).toMatchObject({ importacionPendiente: null, mensaje: "ok" });
  });

  it("cambiar secciones o modo invalida lo preparado (se confirmaría otra cosa)", () => {
    const s1 = compartirReducer(ESTADO_COMPARTIR_INICIAL, { tipo: "importacion-preparada", prep });
    expect(compartirReducer(s1, { tipo: "modo", modo: "merge" }).importacionPendiente).toBeNull();
    expect(compartirReducer(s1, { tipo: "seccion", id: "plan", valor: false }).importacionPendiente).toBeNull();
  });

  it("pedir confirmar el plan exige un plan inspeccionado; cambiar una base retira la confirmación", () => {
    expect(compartirReducer(ESTADO_COMPARTIR_INICIAL, { tipo: "pedir-confirmar-plan" }).confirmarPlan).toBe(false);
    const plan = { bases: [] } as unknown as GraficosShareInspectResult;
    const s1 = compartirReducer(ESTADO_COMPARTIR_INICIAL, { tipo: "plan-inspeccionado", plan, seleccion: {}, mensaje: "" });
    const s2 = compartirReducer(s1, { tipo: "pedir-confirmar-plan" });
    expect(s2.confirmarPlan).toBe(true);
    expect(compartirReducer(s2, { tipo: "base", base: "b", valor: true }).confirmarPlan).toBe(false);
  });

  it("un fallo limpia lo pendiente y, si se pide, olvida el plan", () => {
    const plan = { bases: [] } as unknown as GraficosShareInspectResult;
    const s1 = compartirReducer(ESTADO_COMPARTIR_INICIAL, { tipo: "plan-inspeccionado", plan, seleccion: { a: true }, mensaje: "" });
    const s2 = compartirReducer(s1, { tipo: "fallo", error: "x", olvidarPlan: true });
    expect(s2).toMatchObject({ error: "x", planInspeccionado: null, seleccionBases: {}, ocupado: null });
  });
});
