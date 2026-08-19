import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  CollectionDeployment,
  CollectionPlan,
  CollectionStatePayload,
} from "../../api/recopiladores";
import { AccessSection } from "./AccessSection";

// El plan trae adapter kobo_existing_v1 a propósito: AccessSection inicializa
// su selector con `currentDeployment?.adapter_id ?? plan?.adapter.id`, así
// que esto alcanza para que el render estático caiga en la rama Kobo sin
// simular un cambio de <select> — este repo no usa @testing-library/react,
// solo renderToStaticMarkup (ver PlanSection.test.tsx).
const plan: CollectionPlan = {
  schema: "collection_plan/v1",
  plan_id: "plan-1",
  adapter: { id: "kobo_existing_v1", version: 1 },
  source_ref: { module: "calc-muestra", run_id: "run-1", fingerprint: `sha256:${"1".repeat(64)}` },
  instrument_ref: { revision_id: "instrument-1", sha256: "2".repeat(64), provider: "kobo" },
  unit_type: "classroom_course_schedule",
  units: [{ unit_id: "unit-1", label: "Curso A" }],
  revision: 1,
  input_fingerprint: `sha256:${"3".repeat(64)}`,
};

function deploymentWithAssetUid(assetUid: string): CollectionDeployment {
  return {
    schema: "collection_deployment/v1",
    deployment_id: "dep-1",
    plan_id: "plan-1",
    plan_fingerprint: `sha256:${"3".repeat(64)}`,
    target: { provider: "kobo", asset_uid: assetUid },
    capabilities: { remote_write: { observed: false, source: "disabled_v1" } },
    bindings: [],
    coverage: { units_total: 0, units_with_access: 0, units_missing_access: 0 },
    sensitivity: { access_urls: "operational" },
    status: "draft",
  };
}

function payloadWith(deployment: CollectionDeployment | null): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 0,
    plan,
    deployment,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state };
}

function render(deployment: CollectionDeployment | null) {
  return renderToStaticMarkup(
    <AccessSection payload={payloadWith(deployment)} activeTab="canales" onState={() => undefined} />,
  );
}

describe("target Kobo — enlace personalizado", () => {
  it("agrupa los campos del target en bloques con encabezado", () => {
    const markup = render(null);
    expect(markup).toContain("Conexión");
    expect(markup).toContain("Identidad del asset");
    expect(markup).toContain("Personalización del enlace");
  });

  it("sin asset_uid guardado, el campo de personalizacion ofrece el nombre pelado", () => {
    const markup = render(null);
    expect(markup).toContain("Campo de personalización (avanzado)");
    expect(markup).toContain("Return URL");
    expect(markup).toContain('placeholder="collectorID"');
  });

  it("con asset_uid guardado, el placeholder muestra la ruta XPath completa", () => {
    // Reproduce lo verificado a mano en el navegador: con Asset UID
    // "aNNuP72AedZ886EoAUeV5o" el placeholder pasa de "collectorID" a
    // "/aNNuP72AedZ886EoAUeV5o/collectorID" — el mismo formato del enlace
    // real que Gonzalo confirmó en producción.
    const markup = render(deploymentWithAssetUid("aNNuP72AedZ886EoAUeV5o"));
    expect(markup).toContain('placeholder="/aNNuP72AedZ886EoAUeV5o/collectorID"');
    expect(markup).not.toContain('placeholder="collectorID"');
  });
});
