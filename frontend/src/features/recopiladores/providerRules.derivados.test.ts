import { describe, expect, it } from "vitest";

import type { CollectionDeployment, CollectionPlan, CollectionTarget } from "../../api/recopiladores";
import {
  CAMPO_ACTIVO_DERIVADO,
  CAMPO_ADAPTER_DERIVADO,
  cuerpoDeVistaPrevia,
  deploymentParaEnviar,
  derivadosPendientes,
  localProviderBlocking,
  targetParaEnviar,
} from "./providerRules";

/**
 * H27 — lo que el backend deduce al leer (`deployment_derived_fields`) se
 * pinta, pero no sale hacia el backend como si fuera observado.
 */

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

const target: CollectionTarget = {
  provider: "kobo",
  base_access_url: "https://ee.kobotoolbox.org/x/abc",
  asset_uid: "aX",
  asset_type: "survey",
  deployment_active: true,
};

const deployment: CollectionDeployment = {
  schema: "collection_deployment/v1",
  deployment_id: "dep-1",
  plan_id: "plan-1",
  plan_fingerprint: `sha256:${"3".repeat(64)}`,
  adapter_id: "kobo_existing_v1",
  target,
  capabilities: { remote_write: { observed: false, source: "disabled_v1" } },
  bindings: [],
  coverage: { units_total: 0, units_with_access: 0, units_missing_access: 0 },
  sensitivity: { access_urls: "operational" },
  status: "prepared",
};

const DERIVADOS = [CAMPO_ACTIVO_DERIVADO];

describe("H27 — los campos deducidos no se reenvían", () => {
  it("el cuerpo de la vista previa no lleva deployment_active deducido", () => {
    const pendientes = derivadosPendientes(DERIVADOS, new Set());
    const cuerpo = cuerpoDeVistaPrevia({ adapterId: "kobo_existing_v1", plan, target, pendientes });
    expect(cuerpo.adapter_id).toBe("kobo_existing_v1");
    expect(cuerpo.target).not.toHaveProperty("deployment_active");
    expect(cuerpo.target.asset_uid).toBe("aX");
    // No muta el target que pinta el formulario.
    expect(target.deployment_active).toBe(true);
  });

  it("el deployment del PUT/prepare no lleva deployment_active ni adapter_id deducidos", () => {
    const pendientes = derivadosPendientes([CAMPO_ADAPTER_DERIVADO, CAMPO_ACTIVO_DERIVADO], new Set());
    const cuerpo = deploymentParaEnviar(deployment, pendientes);
    expect(cuerpo).not.toHaveProperty("adapter_id");
    expect(cuerpo.target).not.toHaveProperty("deployment_active");
    expect(cuerpo.target.asset_uid).toBe("aX");
    expect(deployment.adapter_id).toBe("kobo_existing_v1");
    expect(deployment.target.deployment_active).toBe(true);
  });

  it("si el usuario lo cambió, sí se envía", () => {
    const pendientes = derivadosPendientes(DERIVADOS, new Set([CAMPO_ACTIVO_DERIVADO]));
    expect(pendientes).toEqual([]);
    expect(cuerpoDeVistaPrevia({ adapterId: "kobo_existing_v1", plan, target, pendientes }).target.deployment_active).toBe(true);
    expect(deploymentParaEnviar(deployment, pendientes).target.deployment_active).toBe(true);
    expect(targetParaEnviar({ ...target, deployment_active: false }, pendientes).deployment_active).toBe(false);
  });

  it("sin derivados (backend que no deduce) el cuerpo sale entero", () => {
    expect(targetParaEnviar(target, derivadosPendientes(undefined, new Set()))).toEqual(target);
    expect(deploymentParaEnviar(deployment, [])).toEqual(deployment);
  });

  it("el bloqueo local pide confirmar el deducido en vez de darlo por observado", () => {
    expect(localProviderBlocking("kobo_existing_v1", target, DERIVADOS))
      .toEqual(["Confirma que el formulario sigue aceptando respuestas."]);
    expect(localProviderBlocking("kobo_existing_v1", target, [])).toEqual([]);
  });
});
