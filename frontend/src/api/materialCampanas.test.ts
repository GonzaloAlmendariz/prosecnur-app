import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REGISTRO_CRUDO, REGISTRO_VACIO_CRUDO } from "./materialCampanas.fixture";
import {
  ID_DE_CAMPANA_RE,
  apiMaterialCampanaCrear,
  apiMaterialCampanas,
  avisoDelRegistro,
  normalizarEscrituraDeCampana,
  normalizarRegistroDeCampanas,
} from "./materialCampanas";
import { ApiError } from "./core";

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => "sid-1", setItem: () => undefined, removeItem: () => undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizarRegistroDeCampanas", () => {
  it("lee el registro con los escalares de R y descarta lo que no conoce", () => {
    const r = normalizarRegistroDeCampanas(REGISTRO_CRUDO);
    expect(r.schema).toBe("material_campaigns/v1");
    expect(r.registry_revision).toBe(3);
    expect(r.state_revision).toBe(41);
    expect(r.campaigns.map((c) => c.id)).toEqual(["aulas.principal", "correo.egresados"]);
    const [aulas, correo] = r.campaigns;
    expect(aulas.estado).toEqual({
      tipo: "aulas", unidades: 2468, titulares: 175, con_enlace: 120, deployment_status: "prepared", plan_desfasado: false,
    });
    expect(correo.actor).toBe("Egresados");
    expect(correo.persisted).toBe(false);
    expect(correo.estado).toEqual({
      tipo: "correo",
      platform: "mailchimp",
      envios: 2,
      bloques: 7,
      recipients_loaded: true,
      envios_detalle: [
        { send_id: "invitacion", label: "Invitación", last_export_at: "2026-09-02T15:20:00Z", last_export_platform: "mailchimp" },
        { send_id: "recordatorio-1", label: "Recordatorio 1", last_export_at: null, last_export_platform: null },
      ],
    });
  });

  it("devuelve los tres tipos en orden, con su motivo cuando no se pueden crear", () => {
    const r = normalizarRegistroDeCampanas(REGISTRO_CRUDO);
    expect(r.tipos).toEqual([
      { tipo: "aulas", disponible: false, motivo: "El proyecto ya tiene su campaña de aulas." },
      { tipo: "territorial", disponible: false, motivo: "Requiere leer las UMP de Hojas de ruta (E2)" },
      { tipo: "correo", disponible: true, motivo: null },
    ]);
    // `ref` llega como objeto: se lee el nombre en su fuente.
    expect(r.campaigns.map((c) => c.ref)).toEqual(["principal", "egresados"]);
  });

  it("una lista vacía con nombres (`{}`) es cero campañas, no una campaña", () => {
    const r = normalizarRegistroDeCampanas(REGISTRO_VACIO_CRUDO);
    expect(r.campaigns).toEqual([]);
    expect(r.tipos.find((t) => t.tipo === "aulas")?.disponible).toBe(true);
  });

  it("un tipo que no viene no se puede crear", () => {
    const r = normalizarRegistroDeCampanas({ campaigns: [], tipos: [] });
    expect(r.tipos.every((t) => !t.disponible)).toBe(true);
    expect(r.registry_revision).toBeNull();
  });

  it("rechaza lo que no es un registro", () => {
    expect(() => normalizarRegistroDeCampanas(null)).toThrow();
    expect(() => normalizarRegistroDeCampanas([1])).toThrow();
  });

  it("el id cumple la forma del ADR 0111 §4", () => {
    expect(ID_DE_CAMPANA_RE.test("aulas.principal")).toBe(true);
    expect(ID_DE_CAMPANA_RE.test("correo.correo-1")).toBe(true);
    expect(ID_DE_CAMPANA_RE.test("correo.-x")).toBe(false);
    expect(ID_DE_CAMPANA_RE.test("panel.x")).toBe(false);
    // El prefijo tiene que ser el tipo: un id de aulas con tipo correo se descarta.
    const r = normalizarRegistroDeCampanas({ campaigns: [{ id: "aulas.principal", tipo: "correo", name: "x" }] });
    expect(r.campaigns).toEqual([]);
  });

  it("la escritura trae su campaña normalizada", () => {
    const out = normalizarEscrituraDeCampana({ ok: true, campaign: REGISTRO_CRUDO.campaigns[1], registry_revision: [4], state_revision: [42] });
    expect(out.campaign.id).toBe("correo.egresados");
    expect(out.registry_revision).toBe(4);
    expect(() => normalizarEscrituraDeCampana({ ok: true })).toThrow();
  });
});

describe("la ruta todavía ausente", () => {
  it("un 404 sin código de campaña es un backend sin registro: devuelve null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(404, { error: "404 - Resource Not Found" })));
    await expect(apiMaterialCampanas()).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(404, { error: { code: "E_NOT_FOUND", message: "Unknown API route" } })));
    await expect(apiMaterialCampanaCrear({ tipo: "correo", name: "x" })).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(405, "")));
    await expect(apiMaterialCampanas()).resolves.toBeNull();
  });

  it("un 404 de campaña inexistente es un error de verdad", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(404, { error: { code: "E_COLLECTION_CAMPAIGN_NOT_FOUND", message: "No existe" } })));
    const fallo = await apiMaterialCampanaCrear({ tipo: "correo", name: "x" }).catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(ApiError);
    expect(avisoDelRegistro(fallo, "")).toContain("ya no existe");
  });

  it("con la ruta publicada, normaliza la respuesta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(200, REGISTRO_CRUDO)));
    const r = await apiMaterialCampanas();
    expect(r?.campaigns).toHaveLength(2);
  });
});
