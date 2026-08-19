import { describe, expect, it } from "vitest";

import {
  adapterOperation,
  deploymentFromPreview,
  deploymentStatusLabel,
  localProviderBlocking,
} from "./providerRules";

describe("reglas capability-driven de adapters", () => {
  it("bloquea Kobo sin URL de captura, survey y deployment activo", () => {
    expect(localProviderBlocking("kobo_existing_v1", {
      provider: "kobo",
      base_access_url: "https://kf.kobotoolbox.org/#/forms/a1/landing",
      asset_type: "collection",
      deployment_active: false,
    })).toHaveLength(3);
    expect(localProviderBlocking("kobo_existing_v1", {
      provider: "kobo",
      base_access_url: "https://kf.kobotoolbox.org/x/a1",
      asset_type: "survey",
      deployment_active: true,
    })).toEqual([]);
  });

  it("bloquea Web Link sin custom variable", () => {
    expect(localProviderBlocking("surveymonkey_weblink_existing_v1", {
      provider: "surveymonkey",
      base_access_url: "https://es.surveymonkey.com/r/ABC",
      custom_variable: "",
    })).toContain("SurveyMonkey Web Link exige una Custom Variable ya definida.");
  });

  it("recipient nunca toma el camino que fabrica links", () => {
    expect(adapterOperation("surveymonkey_recipient_existing_v1")).toBe("native_link_reuse");
    expect(localProviderBlocking("surveymonkey_recipient_existing_v1", {
      provider: "surveymonkey",
      recipients: [],
    })[0]).toMatch(/no se fabrican localmente/);
  });

  it("extrae deployments de las dos envolturas toleradas", () => {
    const deployment = {
      schema: "collection_deployment/v1" as const,
      deployment_id: "dep-1",
      plan_id: "plan-1",
      plan_fingerprint: "sha256:x",
      target: { provider: "manual" },
      capabilities: {},
      bindings: [],
      coverage: { units_total: 0, units_with_access: 0, units_missing_access: 0 },
      sensitivity: { access_urls: "operational" },
      status: "draft" as const,
    };
    expect(deploymentFromPreview({ deployment })).toBe(deployment);
    expect(deploymentFromPreview({ preview: { deployment } })).toBe(deployment);
  });

  it("traduce los 4 estados del deployment, el resto se muestra tal cual", () => {
    expect(deploymentStatusLabel("draft")).toBe("Borrador");
    expect(deploymentStatusLabel("prepared")).toBe("Preparado");
    expect(deploymentStatusLabel("handed_off")).toBe("Entregado a Monitoreo");
    expect(deploymentStatusLabel("stale")).toBe("Desactualizado");
    // "sin deployment"/"sin plan" son literales en español que ya arma
    // RecopiladoresShell.tsx cuando no hay deployment — no son un estado del
    // backend, tienen que pasar intactos.
    expect(deploymentStatusLabel("sin deployment")).toBe("sin deployment");
  });
});
