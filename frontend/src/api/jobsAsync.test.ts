// Contrato del camino async opt-in (c8b2a644 + sheets/sync 3.8b):
// - los starters mandan `async: true` en el body y tipan el handle del job;
// - el error de dominio embebido en result_data se lee con jobResultDomainError;
// - el result_data de sheets/sync pasa por un normalizador defensivo antes de
//   alimentar onStateChange.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jobResultDomainError } from "./jobs";
import {
  apiMonitoreoSheetsSyncAsync,
  normalizeMonitoreoSheetsSyncResult,
  type MonitoreoState,
} from "./monitoreo";
import { apiCargaImportKoboAsync } from "./xlsformEditor";
import { apiSurveyMonkeyMultibaseRefreshAsync } from "./surveymonkey";
import { ApiError } from "./core";

const START = { ok: true, async: true, job_id: "job-7", kind: "carga.platform.kobo_import" };

function mockFetchOk(payload: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
}

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("starters async", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
    vi.stubGlobal("fetch", mockFetchOk(START));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("apiCargaImportKoboAsync manda async:true y devuelve el handle", async () => {
    const start = await apiCargaImportKoboAsync({ asset_uid: "aX" });
    expect(start).toEqual(START);
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/carga/platform/kobo/import");
    expect(JSON.parse(String(init.body))).toMatchObject({ asset_uid: "aX", async: true });
  });

  test("apiSurveyMonkeyMultibaseRefreshAsync manda async:true", async () => {
    await apiSurveyMonkeyMultibaseRefreshAsync({ months: 12 });
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/surveymonkey/multibase/refresh");
    expect(JSON.parse(String(init.body))).toMatchObject({ months: 12, async: true });
  });

  test("apiMonitoreoSheetsSyncAsync manda source_ids y async:true", async () => {
    await apiMonitoreoSheetsSyncAsync(["src-1"]);
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/monitoreo/sheets/sync");
    expect(JSON.parse(String(init.body))).toEqual({ source_ids: ["src-1"], async: true });
  });
});

describe("jobResultDomainError", () => {
  test("lee el error estructurado {ok:false, error:{...}}", () => {
    const err = jobResultDomainError({
      ok: false,
      error: { code: "E_CARGA_JOB_RUNNING", status: 409, message: "Ya hay un import en curso." },
    });
    expect(err).toMatchObject({ code: "E_CARGA_JOB_RUNNING", status: 409 });
  });

  test("tolera error vacío ({} del unboxed-JSON) con mensaje honesto", () => {
    const err = jobResultDomainError({ ok: false, error: {} });
    expect(err?.code).toBe("E_JOB_RESULT");
    expect(err?.message).toMatch(/sin detalle/);
  });

  test("devuelve null para payloads de éxito o basura", () => {
    expect(jobResultDomainError({ ok: true, estudio: {} })).toBeNull();
    expect(jobResultDomainError(null)).toBeNull();
    expect(jobResultDomainError("x")).toBeNull();
  });
});

describe("normalizeMonitoreoSheetsSyncResult", () => {
  test("acepta el payload síncrono con state", () => {
    const state = { sources: [] } as unknown as MonitoreoState;
    const result = normalizeMonitoreoSheetsSyncResult({
      ok: true,
      synced_at: "2026-07-29T12:00:00Z",
      n_rows: 10,
      n_sources: 2,
      state,
    });
    expect(result.n_rows).toBe(10);
    expect(result.state).toBe(state);
  });

  test("relanza el error de dominio embebido como ApiError", () => {
    expect(() => normalizeMonitoreoSheetsSyncResult({
      ok: false,
      error: { code: "E_SHEETS_AUTH", message: "Credencial de Google inválida." },
    })).toThrowError(ApiError);
  });

  test("rechaza un resultado sin state en vez de propagar estado vacío", () => {
    expect(() => normalizeMonitoreoSheetsSyncResult({ ok: true, n_rows: 3 }))
      .toThrow(/sin estado actualizado/);
  });
});
