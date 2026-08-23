import { describe, expect, it } from "vitest";

import type { CollectionDeployment } from "../../api/recopiladores";
import { handoffReadiness } from "./handoffModel";

function deployment(status: CollectionDeployment["status"]): CollectionDeployment {
  return {
    schema: "collection_deployment/v1",
    deployment_id: "dep-1",
    plan_id: "plan-1",
    plan_fingerprint: "sha256:plan",
    deployment_fingerprint: "sha256:dep",
    target: { provider: "kobo" },
    capabilities: {},
    bindings: [],
    coverage: { units_total: 1, units_with_access: 1, units_missing_access: 0 },
    sensitivity: { access_urls: "operational" },
    status,
    handoff: status === "handed_off" ? {
      schema: "collection_handoff/v1",
      deployment_id: "dep-1",
      deployment_fingerprint: "sha256:dep",
      plan_fingerprint: "sha256:plan",
      handed_off_at: "2026-07-30T10:00:00Z",
      state_revision: 4,
    } : null,
  };
}

describe("handoff idempotente", () => {
  it("reconoce el mismo recibo como entrega estable", () => {
    const first = handoffReadiness(deployment("handed_off"));
    const second = handoffReadiness(deployment("handed_off"));
    expect(first.delivered).toBe(true);
    expect(second.receipt).toEqual(first.receipt);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("solo habilita un deployment preparado y con fingerprint", () => {
    expect(handoffReadiness(deployment("prepared")).ready).toBe(true);
    expect(handoffReadiness(deployment("draft")).ready).toBe(false);
    // El motivo distingue «todavía no está» de «se quedó viejo», que son dos
    // acciones distintas para quien lo lee. Se comprueba esa distinción y no la
    // palabra «reconciliarse», que era jerga y salía en pantalla.
    const viejo = handoffReadiness(deployment("stale")).reason ?? "";
    const sinPreparar = handoffReadiness(deployment("draft")).reason ?? "";
    expect(viejo).toMatch(/cambiaron/);
    expect(viejo).not.toBe(sinPreparar);
  });
});
