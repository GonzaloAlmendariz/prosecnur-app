import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiMonitoreoAulasPublicarLibro } from "../monitoreo";

/**
 * El cliente de publicar-libro: qué viaja en el body y qué vuelve tipado.
 *
 * El contrato del backend (monitoreo_aulas_publicar_libro.R) es «el enlace se
 * recuerda ANTES de publicar; sin enlace en el body, usa el recordado». Aquí se
 * fija la mitad del cliente: escribir un enlace lo manda, no escribirlo manda
 * un body sin `url` —mandar `url: ""` olvidaría el destino en vez de usarlo—.
 */

const RESPUESTA = {
  ok: true,
  spreadsheet_id: "LIBRO123",
  spreadsheet_url: "https://docs.google.com/spreadsheets/d/LIBRO123/edit",
  updated_at: "2026-08-31T12:00:00Z",
  hojas: [
    { hoja: "Aulas Agendadas", accion: "respetada", filas: 45 },
    { hoja: "Aulas Aplicadas (Campo)", accion: "respetada", filas: 12 },
    { hoja: "Base de control", accion: "actualizada", filas: 174 },
  ],
  destino_guardado: true,
  libro_sheets: {
    spreadsheet_id: "LIBRO123",
    url: "https://docs.google.com/spreadsheets/d/LIBRO123/edit",
    updated_at: "2026-08-31T12:00:00Z",
  },
};

function respuesta(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function ultimaLlamada() {
  const [path, init] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
  return { path, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn() });
  vi.stubGlobal("fetch", vi.fn(async () => respuesta(RESPUESTA)));
});

afterEach(() => vi.unstubAllGlobals());

describe("apiMonitoreoAulasPublicarLibro", () => {
  it("con un enlace escrito, lo manda para que quede recordado", async () => {
    await apiMonitoreoAulasPublicarLibro(" https://docs.google.com/spreadsheets/d/NUEVO/edit ");
    const { path, body } = ultimaLlamada();
    expect(path).toBe("/api/monitoreo/aulas/publicar-libro");
    expect(body).toEqual({ url: "https://docs.google.com/spreadsheets/d/NUEVO/edit" });
  });

  it("sin enlace, el body no lleva `url`: el destino recordado lo resuelve quien publica", async () => {
    await apiMonitoreoAulasPublicarLibro();
    const { body } = ultimaLlamada();
    expect(body).toEqual({});
  });

  it("devuelve el resumen por hoja y el destino recordado, tipados", async () => {
    const res = await apiMonitoreoAulasPublicarLibro();
    expect(res.hojas.map((h) => h.accion)).toEqual(["respetada", "respetada", "actualizada"]);
    expect(res.destino_guardado).toBe(true);
    expect(res.libro_sheets?.spreadsheet_id).toBe("LIBRO123");
  });
});
