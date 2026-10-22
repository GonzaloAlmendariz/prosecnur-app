import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiCargarAudiencia,
  apiCrearBorrador,
  apiSincronizarRespuestas,
  normalizeInicioDeJob,
  normalizeResultadoDeAudiencia,
  normalizeResultadoDeBorrador,
} from "../../../api/mailchimpSync";
import { ApiError } from "../../../api/core";
import {
  etiquetaExcluida,
  faltaParaElBorrador,
  guardarEleccionMailchimp,
  guardarRemitente,
  leerEleccionMailchimp,
  leerRemitente,
  mensajeDeError,
  resumenDeAudiencia,
  resumenDeBorrador,
  textoDeAvance,
} from "./mailchimpPorApiModel";

function almacenamiento() {
  const m = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => m.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => { m.set(k, v); }),
    removeItem: vi.fn((k: string) => { m.delete(k); }),
    clear: vi.fn(() => m.clear()),
  };
}

describe("normalizadores de Mailchimp por API", () => {
  it("el inicio de job exige job_id", () => {
    expect(normalizeInicioDeJob({ ok: true, job_id: "j1" })).toEqual({ job_id: "j1" });
    expect(() => normalizeInicioDeJob({ ok: true })).toThrow(/trabajo en segundo plano/);
  });

  it("audiencia: tolera {} de R, escalar de largo 1 y ordena fallos", () => {
    const r = normalizeResultadoDeAudiencia({
      recipients: 45078, created: 45000, updated: 70, failed: 8,
      failed_by_reason: { ERROR_GENERIC: 2, ERROR_INVALID_EMAIL: 6, cero: 0 },
      tagged: 45070, tag: "Docentes", merge_fields_created: "ENLACE",
    });
    expect(r.failed_by_reason).toEqual([{ code: "ERROR_INVALID_EMAIL", n: 6 }, { code: "ERROR_GENERIC", n: 2 }]);
    expect(r.merge_fields_created).toEqual(["ENLACE"]);
    const vacio = normalizeResultadoDeAudiencia({ failed_by_reason: [], merge_fields_created: {} });
    expect(vacio.failed_by_reason).toEqual([]);
    expect(vacio.merge_fields_created).toEqual([]);
    expect(normalizeResultadoDeAudiencia(null).recipients).toBe(0);
  });

  it("borrador: sólo acepta un edit_url de admin.mailchimp.com", () => {
    const ok = normalizeResultadoDeBorrador({
      mailchimp_campaign_id: "c1", web_id: 123, edit_url: "https://us21.admin.mailchimp.com/campaigns/edit?id=123",
      recipient_count: 8, subject: "Prueba", title: "Camp · Recordatorio", images_uploaded: 2,
    });
    expect(ok.edit_url).toBe("https://us21.admin.mailchimp.com/campaigns/edit?id=123");
    expect(ok.web_id).toBe("123");
    expect(normalizeResultadoDeBorrador({ edit_url: "javascript:alert(1)" }).edit_url).toBe("");
    expect(normalizeResultadoDeBorrador({ edit_url: "https://evil.com/x.admin.mailchimp.com/" }).edit_url).toBe("");
    expect(normalizeResultadoDeBorrador({}).recipient_count).toBeNull();
  });
});

describe("rutas de Mailchimp por API", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubGlobal("localStorage", almacenamiento());
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, job_id: "j9" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const llamada = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
    return { url: String(url), body: JSON.parse(String(init.body)) as Record<string, unknown> };
  };

  it("sincronizar y cargar la audiencia devuelven el job", async () => {
    expect(await apiSincronizarRespuestas({ campaign_id: "c", survey_id: "s", list_id: "l", tag: "Respondió" })).toEqual({ job_id: "j9" });
    expect(llamada(0).url).toMatch(/\/api\/recopiladores\/mail-sync$/);
    expect(await apiCargarAudiencia({ campaign_id: "c", list_id: "l", tag: "  " })).toEqual({ job_id: "j9" });
    expect(llamada(1).url).toMatch(/\/mail-sync\/audience$/);
    expect(llamada(1).body).toEqual({ campaign_id: "c", list_id: "l" });
  });

  it("el borrador manda solo las etiquetas con valor", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ ok: true, recipient_count: 8, edit_url: "https://us1.admin.mailchimp.com/campaigns/edit?id=1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const r = await apiCrearBorrador({ campaign_id: "c", send_id: "r1", list_id: "l", from_name: " PULSO ", reply_to: "a@b.pe", tag: "", exclude_tag: "Respondió" });
    expect(r.recipient_count).toBe(8);
    expect(llamada(0).url).toMatch(/\/mail-sync\/campaign$/);
    expect(llamada(0).body).toEqual({ campaign_id: "c", send_id: "r1", list_id: "l", from_name: "PULSO", reply_to: "a@b.pe", exclude_tag: "Respondió" });
  });
});

describe("textos de la tarjeta Mailchimp", () => {
  const audiencia = normalizeResultadoDeAudiencia({
    recipients: 45078, created: 45000, updated: 78, failed: 0, tagged: 45078, tag: "Docentes", merge_fields_created: [],
  });

  it("resume la carga con miles peruanos y solo lo que trae algo", () => {
    expect(resumenDeAudiencia(audiencia)).toEqual({
      titulo: "45,078 contactos en Mailchimp: 45,000 nuevos, 78 actualizados.",
      lineas: ["Todos quedaron con la etiqueta «Docentes»."],
    });
  });

  it("dice los fallos por motivo y los campos creados", () => {
    const r = resumenDeAudiencia({
      ...audiencia, recipients: 8, created: 1, updated: 6, failed: 1, tagged: 7,
      failed_by_reason: [{ code: "ERROR_INVALID_EMAIL", n: 1 }], merge_fields_created: ["ENLACE", "SALUDO"],
    });
    expect(r.titulo).toBe("8 contactos en Mailchimp: 1 nuevo, 6 actualizados.");
    expect(r.lineas).toEqual([
      "1 no se pudo subir (1 por correo no válido).",
      "7 contactos con la etiqueta «Docentes».",
      "Campos nuevos en la audiencia: ENLACE, SALUDO.",
    ]);
  });

  it("resume el borrador", () => {
    const b = normalizeResultadoDeBorrador({ subject: "Recordatorio", recipient_count: 1, images_uploaded: 2 });
    expect(resumenDeBorrador(b)).toEqual({
      titulo: "Borrador listo en Mailchimp.",
      lineas: ["Asunto: «Recordatorio».", "Irá a 1 contacto.", "2 imágenes subidas a Mailchimp."],
    });
    expect(resumenDeBorrador(normalizeResultadoDeBorrador({})).lineas).toEqual(["Mailchimp todavía no calcula a cuántos irá."]);
  });

  it("excluye «respondió» sólo en recordatorios", () => {
    expect(etiquetaExcluida("invitacion", "Respondió")).toBeUndefined();
    expect(etiquetaExcluida("recordatorio", "  ")).toBe("Respondió");
    expect(etiquetaExcluida("recordatorio", "Ya votó")).toBe("Ya votó");
  });

  it("dice qué falta para el borrador", () => {
    expect(faltaParaElBorrador({ from_name: "PULSO", reply_to: "a@b.pe" }, "")).toBe("Elige la audiencia de Mailchimp.");
    expect(faltaParaElBorrador({ from_name: " ", reply_to: "a@b.pe" }, "l")).toBe("Escribe el nombre del remitente.");
    expect(faltaParaElBorrador({ from_name: "PULSO", reply_to: "pulso" }, "l")).toBe("Escribe un correo de respuesta válido.");
    expect(faltaParaElBorrador({ from_name: "PULSO", reply_to: "pulso@enviospulso.pucp.edu.pe" }, "l")).toBe("");
  });

  it("dice el avance del job", () => {
    expect(textoDeAvance(null, "Subiendo")).toBe("Subiendo…");
    expect(textoDeAvance({ percent: 3.3, message: "Mailchimp: 1,500 de 45,078" }, "Subiendo")).toBe("Mailchimp: 1,500 de 45,078 · 3%");
  });

  it("los errores de conexión remiten a Configuración › Conexiones", () => {
    expect(mensajeDeError(new ApiError("E_MAILCHIMP_TOKEN", "Clave inválida"), "x")).toMatch(/Configuración › Conexiones\.$/);
    expect(mensajeDeError(new ApiError("E_COLLECTION_MAIL_REVIEW_BLOCKING", "Revisión"), "x")).not.toMatch(/Conexiones/);
    expect(mensajeDeError("raro", "Por defecto")).toBe("Por defecto");
  });
});

describe("lo recordado en este equipo", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", almacenamiento()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("guarda remitente y elección por campaña", () => {
    expect(leerRemitente()).toEqual({ from_name: "", reply_to: "" });
    guardarRemitente({ from_name: " PULSO PUCP ", reply_to: "pulso@enviospulso.pucp.edu.pe " });
    expect(leerRemitente()).toEqual({ from_name: "PULSO PUCP", reply_to: "pulso@enviospulso.pucp.edu.pe" });
    expect(leerEleccionMailchimp("c1")).toBeNull();
    guardarEleccionMailchimp("c1", { list_id: "l1", tag: "Docentes" });
    expect(leerEleccionMailchimp("c1")).toEqual({ list_id: "l1", tag: "Docentes" });
    expect(leerEleccionMailchimp(null)).toBeNull();
  });

  it("sin almacenamiento no revienta", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } });
    expect(leerRemitente()).toEqual({ from_name: "", reply_to: "" });
    expect(() => guardarRemitente({ from_name: "a", reply_to: "b" })).not.toThrow();
  });
});
