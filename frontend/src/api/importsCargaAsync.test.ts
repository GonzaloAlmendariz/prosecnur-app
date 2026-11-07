// L9 (Meta B): la base integrada y el paquete .sav se importan como job.
// Los starters mandan `async: true` y el resultado del job pasa por el MISMO
// normalizador que la respuesta síncrona, así que la UI recibe la misma forma.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiMultiIntegratedImportAsync, normalizeMultiIntegratedImport } from "./multiIntegrado";
import { apiSurveyMonkeyMultibaseSavBundleImportAsync, normalizeSavBundleImport } from "./surveymonkey";

const START = { ok: true, async: true, job_id: "job-9", kind: "carga.platform.sav_bundle_import" };

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void store.set(key, value)),
    removeItem: vi.fn((key: string) => void store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
}

function cuerpoEnviado(): Record<string, unknown> {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("imports de Carga como job (L9)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(START), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  test("la base integrada pide el job y normaliza el perfil igual que el camino síncrono", async () => {
    const start = await apiMultiIntegratedImportAsync({
      guide_xlsform_file_id: "guia",
      origin_key_name: "origen",
      origins: [],
      connection_profile_id: "  perfil-b  ",
    });
    expect(start.job_id).toBe("job-9");
    expect(cuerpoEnviado()).toMatchObject({ guide_xlsform_file_id: "guia", profile_id: "perfil-b", async: true });
    expect(cuerpoEnviado()).not.toHaveProperty("connection_profile_id");
  });

  test("el paquete .sav pide el job con el mismo cuerpo", async () => {
    await apiSurveyMonkeyMultibaseSavBundleImportAsync({
      file_id: "zip-1",
      file_base_map: { "a.sav": "base_a" },
      missing_required_policy: "fill_blank_warn",
      expected_inspection_fingerprint: "fp",
    });
    expect(cuerpoEnviado()).toMatchObject({ file_id: "zip-1", expected_inspection_fingerprint: "fp", async: true });
  });

  test("el resultado del job se normaliza como la respuesta síncrona", () => {
    const integrada = normalizeMultiIntegratedImport({ n_filas: "12", n_columnas: 4 });
    expect(integrada).toMatchObject({ ok: true, n_filas: 12, n_columnas: 4 });
    const sav = normalizeSavBundleImport({ ok: true, imported_bases: "2", results: [{ base_name: "b" }] }, { file_id: "zip-1" });
    expect(sav.file_id).toBe("zip-1");
    expect(sav.imported_bases).toBe(2);
    expect(sav.results[0].base_name).toBe("b");
  });
});
