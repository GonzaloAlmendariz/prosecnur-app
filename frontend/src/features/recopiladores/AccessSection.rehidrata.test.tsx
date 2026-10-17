import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  CollectionDeployment,
  CollectionPlan,
  CollectionStatePayload,
} from "../../api/recopiladores";
import { AccessSection } from "./AccessSection";

/**
 * H21 — Accesos no rehidrata Kobo al reabrir.
 *
 * `AccessSection.test.tsx` usa un plan `kobo_existing_v1` y el `asset_uid` en
 * el primer nivel del target: una forma que el backend nunca produce. Un
 * estudio de aulas real nace con plan `aulas_v1` y el deployment guarda el
 * Asset UID dentro de `target.remote_ref` (`.ca_target_ref`, en
 * api/R/collection_adapters.R). Con esa forma, el selector caía en «Aulas
 * (compatibilidad)» y la URL base y el Asset UID salían vacíos aunque los
 * enlaces siguieran bien.
 */

const URL_BASE = "https://kobo.example.org/single/x";

const plan: CollectionPlan = {
  schema: "collection_plan/v1",
  plan_id: "plan-aulas",
  adapter: { id: "aulas_v1", version: 1 },
  source_ref: { module: "calc-muestra-aulas", run_id: "run-1", fingerprint: `sha256:${"1".repeat(64)}` },
  instrument_ref: { revision_id: "instrument-1", sha256: "2".repeat(64), provider: "kobo" },
  unit_type: "classroom_course_schedule",
  units: [
    { unit_id: "unit-aulas-1", label: "Aula 1" },
    { unit_id: "unit-aulas-2", label: "Aula 2" },
  ],
  revision: 1,
  input_fingerprint: `sha256:${"3".repeat(64)}`,
};

function binding(unitId: string) {
  return {
    access_id: `access-${unitId}`,
    logical_collector_id: `lc-${unitId}`,
    unit_id: unitId,
    access_kind: "parameterized_link" as const,
    access_ref: URL_BASE,
    prefill: { collectorID: unitId },
    status: "ready",
  };
}

const BASE: CollectionDeployment = {
  schema: "collection_deployment/v1",
  deployment_id: "deployment-plan-aulas-kobo",
  plan_id: "plan-aulas",
  plan_fingerprint: `sha256:${"3".repeat(64)}`,
  target: { provider: "kobo", remote_ref: { asset_uid: "aX" }, return_url: null },
  capabilities: { remote_write: { observed: false, source: "disabled_v1" } },
  bindings: [binding("unit-aulas-1"), binding("unit-aulas-2")],
  coverage: { units_total: 2, units_with_access: 2, units_missing_access: 0 },
  sensitivity: { access_urls: "operational" },
  status: "prepared",
};

function payloadWith(deployment: CollectionDeployment): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 3,
    plan,
    deployment,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state } as unknown as CollectionStatePayload;
}

function render(deployment: CollectionDeployment) {
  return renderToStaticMarkup(
    <AccessSection payload={payloadWith(deployment)} activeTab="canales" onState={() => undefined} />,
  );
}

function adapterSeleccionado(markup: string): string | null {
  return markup.match(/<option value="([^"]+)" selected="">/)?.[1] ?? null;
}

describe("H21 — Accesos rehidrata Kobo desde el deployment real", () => {
  it("con la forma que emite el backend (adapter_id + remote_ref.asset_uid), selecciona Kobo y muestra URL y asset", () => {
    // Forma tras el fix del backend: el deployment declara su adapter y conserva
    // `base_access_url`; el Asset UID sigue viviendo en `remote_ref`.
    const markup = render({
      ...BASE,
      adapter_id: "kobo_existing_v1",
      target: { ...BASE.target, base_access_url: URL_BASE },
    });
    expect(adapterSeleccionado(markup)).toBe("kobo_existing_v1");
    expect(markup).toContain(`value="${URL_BASE}"`);
    expect(markup).toContain('value="aX"');
  });

  it("CONTRATO PROPUESTO — deployment viejo sin adapter_id: adapter desde target.provider y URL desde el primer binding", () => {
    // Deployments guardados antes del fix: sin `adapter_id`, sin
    // `base_access_url` en el target. El fallback de lectura propuesto es
    // inferir el adapter de `target.provider` (kobo → kobo_existing_v1) y la
    // URL base del `access_ref` del primer binding; el Asset UID sale de
    // `target.remote_ref.asset_uid`.
    const markup = render(BASE);
    expect(adapterSeleccionado(markup)).toBe("kobo_existing_v1");
    expect(markup).toContain(`value="${URL_BASE}"`);
    expect(markup).toContain('value="aX"');
  });
});
