import { describe, expect, it } from "vitest";
import type { MonitoreoSource } from "../../../../../api/monitoreo";
import { koboDeLaFase, ocurrenciasDeCampo, planTerritorialDeActualizar } from "./planTerritorial";

// La forma de acnurcg: un Kobo por fase y un formulario de ocurrencias.
const fuente = (parcial: Partial<MonitoreoSource> & Pick<MonitoreoSource, "id">): MonitoreoSource => ({
  kind: "kobo",
  label: parcial.id,
  enabled: true,
  role: "respuestas",
  ...parcial,
});
const SOURCES: MonitoreoSource[] = [
  fuente({ id: "kobo_piloto", label: "Encuesta piloto" }),
  fuente({ id: "kobo_campo", label: "Encuesta VF · Campo", dimensions: { territorial_phase: "field" } }),
  fuente({ id: "occ", label: "OCURRENCIAS DE TRABAJO DE CAMPO", role: "ocurrencias_campo", asset_uid: "aOcc" }),
];
const CONFIG = {
  phase_sources: {
    pilot: { source_id: "kobo_piloto", asset_uid: "aPil" },
    field: { source_id: "kobo_campo", asset_uid: "aCam" },
  },
  field_occurrences: { source_id: "occ", asset_uid: "aOcc" },
};

describe("plan del «Actualizar ▾» territorial", () => {
  it("el cuerpo lee lo nuevo del Kobo de la fase activa y las ocurrencias", () => {
    const plan = planTerritorialDeActualizar({ sources: SOURCES, config: CONFIG, fase: "field" });
    expect(plan.principal.peticion).toEqual({ tipo: "sync", modo: "advance", fuentes: ["kobo_campo", "occ"] });
    expect(plan.principal.disabled).toBe(false);
  });

  it("el menú lleva «Traer todo de nuevo», «Recalcular» y una entrada por fuente, piloto y campo aparte", () => {
    const plan = planTerritorialDeActualizar({ sources: SOURCES, config: CONFIG, fase: "field", pendienteDeRecalcular: true });
    expect(plan.menu.map((e) => e.clave)).toEqual(["todo", "recalcular", "fuente:kobo_campo", "fuente:kobo_piloto", "fuente:occ"]);
    const porClave = Object.fromEntries(plan.menu.map((e) => [e.clave, e]));
    expect(porClave.todo.peticion).toEqual({ tipo: "sync", modo: "full", fuentes: ["kobo_campo", "occ"] });
    expect(porClave.recalcular).toMatchObject({ etiqueta: "Recalcular", detalle: "Hay cambios sin recalcular", peticion: { tipo: "recalcular" } });
    expect(porClave["fuente:kobo_campo"]).toMatchObject({ detalle: "Kobo · campo, fase activa", grupo: "fuentes", peticion: { tipo: "sync", modo: "full", fuentes: ["kobo_campo"] } });
    expect(porClave["fuente:kobo_piloto"]).toMatchObject({ detalle: "Kobo · piloto", peticion: { tipo: "sync", modo: "full", fuentes: ["kobo_piloto"] } });
    expect(porClave["fuente:occ"]).toMatchObject({ detalle: "Kobo · ocurrencias de campo", peticion: { tipo: "sync", modo: "full", fuentes: ["occ"] } });
    expect(plan.menu.some((e) => e.etiqueta === "Solo recalcular")).toBe(false);
  });

  it("una sola fuente para las dos fases da una sola entrada", () => {
    const config = { phase_sources: { pilot: { source_id: "kobo_campo" }, field: { source_id: "kobo_campo" } } };
    const plan = planTerritorialDeActualizar({ sources: SOURCES.slice(1, 2), config, fase: "pilot" });
    const kobo = plan.menu.filter((e) => e.grupo === "fuentes");
    expect(kobo).toHaveLength(1);
    expect(kobo[0].detalle).toBe("Kobo · piloto y campo");
    expect(plan.principal.peticion).toEqual({ tipo: "sync", modo: "advance", fuentes: ["kobo_campo"] });
  });

  it("la hoja de ruta de Sheets entra al menú por el camino de las hojas", () => {
    const hoja = fuente({ id: "ruta", kind: "google_sheets", role: "hoja_ruta", label: "Hojas de ruta" });
    const plan = planTerritorialDeActualizar({ sources: [...SOURCES, hoja], config: CONFIG, fase: "field" });
    expect(plan.menu.find((e) => e.clave === "fuente:ruta")).toMatchObject({ detalle: "Google Sheets · hoja de ruta", peticion: { tipo: "hojas", fuentes: ["ruta"] } });
  });

  it("sin Kobo, el cuerpo se apaga y dice por qué", () => {
    const plan = planTerritorialDeActualizar({ sources: [], config: {}, fase: "field" });
    expect(plan.principal).toMatchObject({ disabled: true, titulo: "Define primero una fuente Kobo para Campo." });
    expect(plan.menu.map((e) => e.clave)).toEqual(["todo", "recalcular"]);
    expect(plan.menu[0].disabled).toBe(true);
    expect(plan.menu[1].disabled).toBe(false);
  });

  it("el Kobo de la fase sigue el orden de búsqueda de la página y las ocurrencias salen de la config", () => {
    expect(koboDeLaFase(SOURCES, CONFIG, "pilot")?.id).toBe("kobo_piloto");
    expect(koboDeLaFase(SOURCES, {}, "pilot")?.id).toBe("kobo_piloto");
    expect(ocurrenciasDeCampo(SOURCES, CONFIG)).toEqual({ id: "occ", source_id: "occ", asset_uid: "aOcc", etiqueta: "OCURRENCIAS DE TRABAJO DE CAMPO" });
    expect(ocurrenciasDeCampo(SOURCES, { field_occurrences: { asset_uid: "aNuevo" } })).toEqual({ id: "ocurrencias:aNuevo", asset_uid: "aNuevo", etiqueta: "Ocurrencias de campo" });
    expect(ocurrenciasDeCampo(SOURCES, {})).toBeNull();
  });
});
