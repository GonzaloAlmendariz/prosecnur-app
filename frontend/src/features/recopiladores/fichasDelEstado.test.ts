import { describe, expect, it } from "vitest";

import type { CollectionMaterialInstance, CollectionPlan, CollectionState } from "../../api/recopiladores";
import { unidadesDelPlan } from "./codigoOperativo";
// H22 — módulo PROPUESTO, aún no existe: el implementador lo crea con estos
// nombres (`frontend/src/features/recopiladores/fichasDelEstado.ts`).
import { fichasHechasDelEstado, instanciaReutilizable } from "./fichasDelEstado";
import { cuentaDeFichas } from "./MaterialsSection";

/**
 * H22 — Paquetes decía «0 de 2,373» con las fichas ya hechas.
 *
 * El numerador salía de `instances.length`, un `useState([])` que nunca se
 * carga de `payload.state.material_instances` (el normalizador sí lo trae,
 * api/recopiladores.ts). Y aun cargado, contaba INSTANCIAS: una sola instancia
 * cubre las 2.373 unidades en `unit_refs`. El numerador tiene que salir del
 * estado persistido y contar UNIDADES del plan cubiertas por instancias no
 * stale.
 */

const plan: CollectionPlan = {
  schema: "collection_plan/v1",
  plan_id: "plan-aulas",
  adapter: { id: "aulas_v1", version: 1 },
  source_ref: { module: "calc-muestra-aulas", run_id: "run-1", fingerprint: `sha256:${"1".repeat(64)}` },
  instrument_ref: { revision_id: "instrument-1", sha256: "2".repeat(64) },
  unit_type: "classroom_course_schedule",
  units: [
    { unit_id: "u-1", label: "Aula 1" },
    { unit_id: "u-2", label: "Aula 2" },
    { unit_id: "u-3", label: "Aula 3" },
  ],
  revision: 1,
  input_fingerprint: `sha256:${"3".repeat(64)}`,
};

function instancia(id: string, unitRefs: string[], status = "ready"): CollectionMaterialInstance {
  return {
    schema: "collection_material_instance/v1",
    instance_id: id,
    template_ref: { template_id: "ficha", revision: 1, sha256: "4".repeat(64) },
    deployment_id: "deployment-1",
    deployment_fingerprint: `sha256:${"5".repeat(64)}`,
    unit_refs: unitRefs,
    access_refs: unitRefs.map((u) => `access-${u}`),
    locale: "es-PE",
    status,
    sensitivity: "operational",
    warnings: [],
  };
}

function estado(instances: CollectionMaterialInstance[]): CollectionState {
  return {
    schema: "collection_state/v1",
    state_revision: 7,
    plan,
    deployment: null,
    material_instances: instances,
    artifact_receipts: [],
  };
}

describe("H22 — fichas hechas salen del estado persistido", () => {
  it("una instancia persistida que cubre las 3 unidades del plan da «3 de 3»", () => {
    const state = estado([instancia("inst-1", ["u-1", "u-2", "u-3"])]);
    expect(fichasHechasDelEstado(state)).toBe(3);
    expect(cuentaDeFichas(fichasHechasDelEstado(state), unidadesDelPlan(state.plan))).toBe("3 de 3");
  });

  it("cuenta unidades distintas del plan, no instancias, y no cuenta las stale", () => {
    const state = estado([
      instancia("inst-1", ["u-1", "u-2"]),
      instancia("inst-2", ["u-2"]), // repetida: no suma dos veces
      instancia("inst-3", ["u-3"], "stale"), // stale: no cuenta
      instancia("inst-4", ["u-fuera-del-plan"]), // fuera del plan: no cuenta
    ]);
    expect(fichasHechasDelEstado(state)).toBe(2);
  });

  it("sin estado o sin instancias da 0", () => {
    expect(fichasHechasDelEstado(null)).toBe(0);
    expect(fichasHechasDelEstado(estado([]))).toBe(0);
  });
});

describe("H22 — generar reutiliza la instancia persistida en vez de crear otra", () => {
  it("devuelve la instancia persistida no stale", () => {
    const state = estado([instancia("inst-stale", ["u-1"], "stale"), instancia("inst-1", ["u-1", "u-2", "u-3"])]);
    expect(instanciaReutilizable(state)?.instance_id).toBe("inst-1");
  });

  it("sin instancias vigentes devuelve null (y sólo entonces se crea una)", () => {
    expect(instanciaReutilizable(estado([instancia("inst-stale", ["u-1"], "stale")]))).toBeNull();
    expect(instanciaReutilizable(null)).toBeNull();
  });
});
