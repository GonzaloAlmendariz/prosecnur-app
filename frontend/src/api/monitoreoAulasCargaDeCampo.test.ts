/**
 * El Excel de la carga de campo lo arma el motor (ADR 0133, fase 5): el cuerpo
 * viaja con las mismas opciones que la vista y la respuesta conserva los campos
 * del entregable para el kit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./core";
import { apiMonitoreoAulasCargaDeCampoExcel, cuerpoDeCargaDeCampo, normalizarCargaDeCampoExcel } from "./monitoreoAulasCargaDeCampo";
import { archivoDesdeRespuesta } from "../components/entregables/archivoDesdeRespuesta";

function memoria() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear() };
}

beforeEach(() => vi.stubGlobal("localStorage", memoria()));
afterEach(() => vi.unstubAllGlobals());

describe("cuerpoDeCargaDeCampo", () => {
  it("en el idioma del motor, con las ventanas como arreglo y minutos enteros", () => {
    expect(cuerpoDeCargaDeCampo({
      duracionMin: 30, eje: "calendario", preparacionMin: 30, salidaMin: 15,
      ventanas: [{ codigo: "CH 1", fecha: "2026-09-14", inicioMin: 600.4 }],
    })).toEqual({
      duracion_min: 30, eje: "calendario", preparacion_min: 30, salida_min: 15,
      ventanas: [{ codigo: "CH 1", fecha: "2026-09-14", inicio_min: 600 }],
    });
  });

  it("lo que no se pidió no viaja: el motor pone su valor", () => {
    expect(cuerpoDeCargaDeCampo({ duracionMin: 45 })).toEqual({ duracion_min: 45 });
  });
});

describe("normalizarCargaDeCampoExcel", () => {
  const RESPUESTA = {
    ok: true, file_id: "cc1", filename: "HSVG2026_Carga_de_campo_calendario_10_11_26.xlsx", size: [2048],
    eje: ["calendario"], duracion_min: 30, agendadas: 12, por_agendar: 3,
    pico: { firmes: 4, plausibles: 2, fila: "Lunes 14/09", franja: "10:00", aulas: 6 },
    modulo: "Monitoreo", rotulo: "Carga de campo", guardado_en: "C:\\E\\Entregables\\Monitoreo\\x.xlsx", aviso_guardado: {},
  };

  it("conserva los campos del entregable y el kit lo lee como un .xlsx guardado", () => {
    const n = normalizarCargaDeCampoExcel(RESPUESTA);
    expect(n).toMatchObject({ file_id: "cc1", eje: "calendario", agendadas: 12, por_agendar: 3, size: 2048, modulo: "Monitoreo", guardado_en: "C:\\E\\Entregables\\Monitoreo\\x.xlsx" });
    expect(n.pico).toEqual({ firmes: 4, plausibles: 2, fila: "Lunes 14/09", franja: "10:00", aulas: 6 });
    const [archivo] = archivoDesdeRespuesta(n);
    expect(archivo).toMatchObject({ fileId: "cc1", formato: "xlsx", tamano: 2048, guardadoEn: "C:\\E\\Entregables\\Monitoreo\\x.xlsx", avisoGuardado: null });
  });

  it("sin pico (un NULL de R llega como {}) queda en null", () => {
    expect(normalizarCargaDeCampoExcel({ ...RESPUESTA, pico: {} }).pico).toBeNull();
    expect(normalizarCargaDeCampoExcel({ ok: true, file_id: "x" }).eje).toBe("semana");
  });
});

describe("apiMonitoreoAulasCargaDeCampoExcel", () => {
  it("pide el endpoint del motor con el cuerpo de la vista", async () => {
    let enviado: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      enviado = init;
      return new Response(JSON.stringify({ ok: true, file_id: "cc2", filename: "Carga.xlsx", size: 10, eje: "semana", duracion_min: 30, agendadas: 0, por_agendar: 5 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const r = await apiMonitoreoAulasCargaDeCampoExcel({ duracionMin: 30, eje: "semana" });
    const llamada = vi.mocked(fetch).mock.calls[0];
    expect(String(llamada[0])).toContain("/api/monitoreo/aulas/carga-de-campo/excel");
    expect(enviado?.method).toBe("POST");
    expect(JSON.parse(String(enviado?.body))).toEqual({ duracion_min: 30, eje: "semana" });
    expect(r).toMatchObject({ file_id: "cc2", por_agendar: 5, pico: null });
  });

  it("un 409 sin horario llega como ApiError con su código, para que el contenedor lo diga", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false, error: { code: "E_MONITOREO_CARGA_CAMPO_SIN_HORARIO", message: "Ningún curso-horario titular trae su horario de sesiones: no hay carga que calcular." },
    }), { status: 409, headers: { "Content-Type": "application/json" } })));
    const e = await apiMonitoreoAulasCargaDeCampoExcel({ duracionMin: 30 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe("E_MONITOREO_CARGA_CAMPO_SIN_HORARIO");
  });
});
