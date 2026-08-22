import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiRecopiladoresDeploymentPrepare,
  apiRecopiladoresDeploymentPreview,
  apiRecopiladoresHandoff,
  apiRecopiladoresMaterialInstances,
  apiRecopiladoresMaterialsRender,
  apiRecopiladoresMaterialTemplateGet,
  apiRecopiladoresPlanPut,
  apiRecopiladoresProviderPreflight,
  apiRecopiladoresState,
  normalizeCollectionStatePayload,
  type CollectionPlan,
} from "./recopiladores";

const plan: CollectionPlan = {
  schema: "collection_plan/v1",
  plan_id: "plan-1",
  adapter: { id: "aulas_v1", version: 1 },
  source_ref: { module: "calc-muestra", run_id: "run-1", fingerprint: `sha256:${"1".repeat(64)}` },
  instrument_ref: { revision_id: "instrument-1", sha256: "2".repeat(64), provider: "kobo" },
  unit_type: "classroom_course_schedule",
  units: [{ unit_id: "unit-1", label: "Curso A" }],
  revision: 1,
  input_fingerprint: `sha256:${"3".repeat(64)}`,
};

const emptyState = {
  ok: true,
  schema: "collection_state/v1",
  state_revision: 0,
  plan: null,
  deployment: null,
  state: { schema: "collection_state/v1", state_revision: 0, plan: null, deployment: null },
};

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function lastRequest() {
  const [path, init] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
  return { path, init, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn() });
  vi.stubGlobal("fetch", vi.fn(async () => response(emptyState)));
});

afterEach(() => vi.unstubAllGlobals());

describe("cliente API de Recopiladores", () => {
  it("consulta el estado con sesión y rechaza schemas desconocidos", async () => {
    await apiRecopiladoresState();
    expect(lastRequest().path).toBe("/api/recopiladores/state");
    expect(lastRequest().init?.method).toBeUndefined();
    expect(new Headers(lastRequest().init?.headers).get("X-Pulso-Session")).toBe("sid-test");

    expect(() => normalizeCollectionStatePayload({ ...emptyState, schema: "otro/v1", state: undefined }))
      .toThrow(/schema de estado desconocido/);
    expect(() => normalizeCollectionStatePayload({ ...emptyState, state_revision: "uno", state: undefined }))
      .toThrow(/state_revision/);
  });

  it("guarda el plan con expected_revision sin renombrar el contrato", async () => {
    await apiRecopiladoresPlanPut(7, plan);
    expect(lastRequest()).toMatchObject({
      path: "/api/recopiladores/plan",
      init: { method: "PUT" },
      body: { expected_revision: 7, plan },
    });
  });

  it("prepara y entrega usando solo endpoints locales de Recopiladores", async () => {
    await apiRecopiladoresDeploymentPrepare(8);
    expect(lastRequest()).toMatchObject({
      path: "/api/recopiladores/deployment/prepare",
      init: { method: "POST" },
      body: { expected_revision: 8 },
    });
    await apiRecopiladoresHandoff(9, "sha256:deployment");
    expect(lastRequest()).toMatchObject({
      path: "/api/recopiladores/handoff",
      body: { expected_revision: 9, deployment_fingerprint: "sha256:deployment" },
    });
  });

  it("envía preflight y preview con adapter y target separados", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      schema: "collection_capability_preflight/v1",
      adapter_id: "kobo_existing_v1",
      operation_policy: "v1_read_only",
      capabilities: {},
      blocking: {},
      warnings: {},
    }));
    await apiRecopiladoresProviderPreflight({
      adapter_id: "kobo_existing_v1",
      operation: "local_generation",
      connection_ref: { connection_profile_id: "profile-1" },
      target_ref: { provider: "kobo", asset_uid: "asset-1" },
    });
    expect(lastRequest()).toMatchObject({
      path: "/api/recopiladores/provider-preflight",
      body: {
        adapter_id: "kobo_existing_v1",
        operation: "local_generation",
        connection_ref: { connection_profile_id: "profile-1" },
        target_ref: { provider: "kobo", asset_uid: "asset-1" },
      },
    });

    await apiRecopiladoresDeploymentPreview({
      adapter_id: "kobo_existing_v1",
      plan,
      target: { provider: "kobo", asset_type: "survey", deployment_active: true },
    });
    expect(lastRequest().path).toBe("/api/recopiladores/deployment/preview");
    expect(lastRequest().body).toMatchObject({ adapter_id: "kobo_existing_v1", plan });
  });

  it("normaliza NULL unboxed en template e instances", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ ok: true, template: {} }))
      .mockResolvedValueOnce(response({ ok: true, instance: {} }));
    await expect(apiRecopiladoresMaterialTemplateGet()).resolves.toMatchObject({ template: null });
    await expect(apiRecopiladoresMaterialInstances({ expected_revision: 2 })).resolves.toMatchObject({ instances: [] });
  });

  it("inicia renders PNG/PDF/bundle como jobs y exige job_id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ ok: true, job_id: "job-1", kind: "collection_material_render" }));
    await expect(apiRecopiladoresMaterialsRender({ format: "png", instance_id: "material-1" }))
      .resolves.toMatchObject({ job_id: "job-1" });
    expect(lastRequest()).toMatchObject({
      path: "/api/recopiladores/materials/render",
      body: { format: "png", instance_id: "material-1" },
    });
  });
});

describe("el normalizador no se come los campos nuevos", () => {
  // Costó un diagnóstico entero el 2026-08-22: `source_vigente` llegaba correcto
  // en el JSON —comprobado con curl contra la API— y no aparecía en pantalla,
  // con el backend, el endpoint y el componente los tres bien. El normalizador
  // reconstruye el payload campo por campo y lo descartaba en silencio.
  const base = {
    ok: true, noop: true, seeded: false, seed_available: false,
    state: {
      schema: "collection_state/v1", state_revision: 1,
      plan: null, deployment: null, migration: null,
    },
  };

  it("deja pasar el veredicto de vigencia del backend", () => {
    const p = normalizeCollectionStatePayload({
      ...base,
      source_vigente: {
        plan_run_id: "sel_aulas_20260801211224_e32c240d",
        selection_run_id: "sel_aulas_20260821160928_bf10d14c",
        desfasado: true,
      },
    });
    expect(p.source_vigente?.desfasado).toBe(true);
    expect(p.source_vigente?.plan_run_id).toBe("sel_aulas_20260801211224_e32c240d");
  });

  it("sin veredicto no inventa uno", () => {
    expect(normalizeCollectionStatePayload(base).source_vigente).toBeNull();
  });

  it("un desfasado que no sea `true` no se lee como alarma", () => {
    // El backend manda booleanos, pero un `"true"` de cadena no puede colarse
    // como veredicto: la alarma diría que el plan está viejo sin saberlo.
    const p = normalizeCollectionStatePayload({
      ...base,
      source_vigente: { plan_run_id: "a", selection_run_id: "b", desfasado: "true" },
    });
    expect(p.source_vigente?.desfasado).toBe(false);
  });

  it("deja pasar lo descartado tras rehacer el plan", () => {
    const p = normalizeCollectionStatePayload({
      ...base, reseeded: true,
      descartado: { plan_run_id: "viejo", unidades: 2468, tenia_despliegue: true, entregado: false },
    });
    expect(p.reseeded).toBe(true);
    expect(p.descartado?.unidades).toBe(2468);
    expect(p.descartado?.entregado).toBe(false);
  });
});
