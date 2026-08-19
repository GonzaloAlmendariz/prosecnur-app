import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CollectionDeployment, CollectionStatePayload } from "../../api/recopiladores";
import { DeliverySection } from "./DeliverySection";

function payloadWithDeployment(deployment: CollectionDeployment | null): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 1,
    plan: null,
    deployment,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state };
}

const BASE_DEPLOYMENT: CollectionDeployment = {
  schema: "collection_deployment/v1",
  deployment_id: "dep-1",
  plan_id: "plan-1",
  plan_fingerprint: "fp",
  deployment_fingerprint: "fp-dep",
  target: { provider: "kobo" },
  capabilities: {},
  bindings: [],
  coverage: { units_total: 12, units_with_access: 12, units_missing_access: 0 },
  sensitivity: { access_urls: "operational" },
  status: "prepared",
};

describe("proveedor del target, capitalizado igual que en Accesos", () => {
  it("traduce kobo/surveymonkey a su nombre de marca, no la clave cruda", () => {
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(BASE_DEPLOYMENT)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain(">Kobo<");
    expect(markup).not.toContain(">kobo<");
  });

  it("manual no es una marca, se muestra tal cual", () => {
    const deployment = { ...BASE_DEPLOYMENT, target: { provider: "manual" } };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(deployment)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain(">manual<");
  });

  it("un proveedor no mapeado se muestra tal cual, no se inventa una etiqueta", () => {
    const deployment = { ...BASE_DEPLOYMENT, target: { provider: "un_proveedor_futuro" } };
    const markup = renderToStaticMarkup(
      <DeliverySection payload={payloadWithDeployment(deployment)} latestArtifact={null} onState={() => undefined} />,
    );
    expect(markup).toContain(">un_proveedor_futuro<");
  });
});
