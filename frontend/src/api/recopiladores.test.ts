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
  apiRecopiladoresReseed,
  apiRecopiladoresReseedPreview,
  apiRecopiladoresState,
  normalizeCollectionStatePayload,
  normalizeReseedDescartado,
  normalizeReseedPropuesto,
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

  it("H27: conserva deployment_derived_fields (sólo texto) y cae a [] sin él", () => {
    expect(normalizeCollectionStatePayload({
      ...emptyState,
      deployment_derived_fields: ["adapter_id", "target.deployment_active", 3, "", null],
    }).deployment_derived_fields).toEqual(["adapter_id", "target.deployment_active"]);
    expect(normalizeCollectionStatePayload(emptyState).deployment_derived_fields).toEqual([]);
    expect(normalizeCollectionStatePayload({ ...emptyState, deployment_derived_fields: [] }).deployment_derived_fields)
      .toEqual([]);
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

/**
 * H25 — `handoff = NULL` en R llega como `{}` y se tomaba por recibo.
 *
 * Payload real de hsvg2026_con_plan_v2.pulso (GET /api/recopiladores/state):
 * sin `handoff` de primer nivel y `state.deployment.handoff: {}`, con el
 * despliegue `prepared`. La tarjeta pintaba «Recibo firmado» con todo en «—».
 */
describe("un recibo de traspaso sólo existe con su contrato", () => {
  const deployment = {
    schema: "collection_deployment/v1",
    deployment_id: "dep-1",
    plan_id: "plan-1",
    plan_fingerprint: "fp-plan",
    deployment_fingerprint: "fp-dep",
    target: { provider: "kobo" },
    capabilities: {},
    bindings: [],
    coverage: { units_total: 1, units_with_access: 1, units_missing_access: 0 },
    sensitivity: { access_urls: "operational" },
    status: "prepared",
  };
  const payload = (dep: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    ok: true, noop: true, seed_available: false,
    state: { schema: "collection_state/v1", state_revision: 4, plan: null, deployment: dep },
    ...extra,
  });
  const recibo = {
    schema: "collection_handoff/v1",
    deployment_id: "dep-1",
    deployment_fingerprint: "fp-dep",
    plan_fingerprint: "fp-plan",
    handed_off_at: "2026-10-16T10:00:00Z",
    state_revision: 5,
  };

  it("sin traspaso, el {} del NULL de R no es recibo (ni arriba ni en el despliegue)", () => {
    const p = normalizeCollectionStatePayload(payload({ ...deployment, handoff: {} }, { handoff: {} }));
    expect(p.handoff).toBeNull();
    expect(p.state.deployment?.handoff).toBeNull();
  });

  it("un recibo al que le falta un campo obligatorio tampoco cuenta", () => {
    const incompleto: Record<string, unknown> = { ...recibo };
    delete incompleto.handed_off_at;
    const p = normalizeCollectionStatePayload(payload({ ...deployment, handoff: incompleto }));
    expect(p.handoff).toBeNull();
  });

  it("con traspaso, el recibo llega entero desde el despliegue", () => {
    const p = normalizeCollectionStatePayload(payload({ ...deployment, status: "handed_off", handoff: recibo }));
    expect(p.handoff).toEqual(recibo);
    expect(p.state.deployment?.handoff).toEqual(recibo);
  });
});

/**
 * H26 — rehacer el plan se previsualiza antes de escribir.
 *
 * Contrato del backend (83bbeb44a): `POST /api/recopiladores/reseed` con
 * `{ expected_revision, dry_run }`. Con `dry_run: true` no muta y devuelve el
 * mismo `descartado` que la escritura, más `propuesto`.
 */
describe("rehacer el plan: previsualización y escritura", () => {
  const descartadoReal = {
    plan_run_id: "sel_aulas_20260801211224_e32c240d",
    unidades: 2373,
    tenia_despliegue: true,
    entregado: false,
    fichas: { instancias: 1, unidades_cubiertas: 2373 },
    recibos: 1,
    publicaciones_drive: 0,
    otros_campos: [],
    conservado: ["material_template", "pruebas"],
  };

  it("la previsualización pide dry_run y no otra cosa", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      ...emptyState, noop: true, dry_run: true, reseeded: false,
      descartado: descartadoReal, propuesto: { plan_run_id: "sel_aulas_20260821160928_b", unidades: 2400 },
    }));
    const p = await apiRecopiladoresReseedPreview(7);
    expect(lastRequest().path).toBe("/api/recopiladores/reseed");
    expect(lastRequest().init?.method).toBe("POST");
    expect(lastRequest().body).toEqual({ expected_revision: 7, dry_run: true });
    expect(p.dry_run).toBe(true);
    expect(p.reseeded).toBe(false);
    expect(p.descartado?.fichas).toEqual({ instancias: 1, unidades_cubiertas: 2373 });
    expect(p.descartado?.recibos).toBe(1);
    expect(p.propuesto).toEqual({ plan_run_id: "sel_aulas_20260821160928_b", unidades: 2400 });
  });

  it("la escritura declara dry_run en falso: ausente sería ambiguo", async () => {
    await apiRecopiladoresReseed(7);
    expect(lastRequest().body).toEqual({ expected_revision: 7, dry_run: false });
  });

  it("normaliza escalares que R manda como vector de uno", () => {
    const d = normalizeReseedDescartado({
      plan_run_id: ["run-x"], unidades: [10], tenia_despliegue: [true], entregado: [false],
      fichas: { instancias: [2], unidades_cubiertas: [9] }, recibos: [3], publicaciones_drive: [1],
      otros_campos: "campo_raro", conservado: ["mail_template", "mail_template", ""],
    });
    expect(d).toEqual({
      plan_run_id: "run-x", unidades: 10, tenia_despliegue: true, entregado: false,
      fichas: { instancias: 2, unidades_cubiertas: 9 }, recibos: 3, publicaciones_drive: 1,
      otros_campos: ["campo_raro"], conservado: ["mail_template"],
    });
  });

  it("un conteo ilegible es cero y un booleano que no sea true no se afirma", () => {
    const d = normalizeReseedDescartado({
      unidades: "muchas", recibos: -2, publicaciones_drive: null,
      tenia_despliegue: "true", entregado: 1, fichas: "x",
    });
    expect(d?.unidades).toBe(0);
    expect(d?.recibos).toBe(0);
    expect(d?.publicaciones_drive).toBe(0);
    expect(d?.tenia_despliegue).toBe(false);
    expect(d?.entregado).toBe(false);
    expect(d?.fichas).toEqual({ instancias: 0, unidades_cubiertas: 0 });
    expect(d?.otros_campos).toEqual([]);
    expect(d?.conservado).toEqual([]);
  });

  it("sin objeto no hay descartado ni propuesto", () => {
    expect(normalizeReseedDescartado(null)).toBeNull();
    expect(normalizeReseedDescartado([])).toBeNull();
    expect(normalizeReseedPropuesto(undefined)).toBeNull();
    expect(normalizeReseedPropuesto({ unidades: [5] })).toEqual({ plan_run_id: "", unidades: 5 });
  });
});
