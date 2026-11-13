import { describe, expect, it } from "vitest";
import { buildDecisionPayload } from "../limpieza/modeloLimpieza";
import type { CandidatoDeCatalogo } from "../../../api/validacionAuditoria";
import {
  columnasDeRoles,
  correccionesGuardadas,
  decisionesDeCorreccion,
  lugarDeCandidato,
  lugarDelSelector,
  propuestaEnPalabras,
} from "./correccionDelCaso";

const roles = { departamento: "P2_dep", provincia: "P2_prov", distrito: "P2_dist", ubigeo: "P2_ubigeo" };
const candidato: CandidatoDeCatalogo = {
  rol: "distrito",
  valor: "Comas",
  entidad: { departamento: "Lima", provincia: "Lima", distrito: "Comas", ubigeo: "150110" },
  causa: "por el ubigeo 150110",
};

describe("corrección de un caso de catálogo", () => {
  it("la propuesta dice el lugar y su causa", () => {
    expect(propuestaEnPalabras(candidato)).toBe("Propuesta: Distrito Comas (por el ubigeo 150110)");
    expect(propuestaEnPalabras({ ...candidato, rol: "ubigeo", valor: "150110", causa: "por el distrito Comas" }))
      .toBe("Propuesta: Ubigeo 150110 (por el distrito Comas)");
  });

  it("las columnas salen de los papeles de la regla; las que no usa quedan sin columna", () => {
    expect(columnasDeRoles({ distrito: "d", departamento: "x" })).toEqual({ departamento: "x", provincia: null, distrito: "d", ubigeo: null });
    expect(columnasDeRoles(undefined)).toEqual({ departamento: null, provincia: null, distrito: null, ubigeo: null });
  });

  it("el candidato y el selector dan el mismo lugar", () => {
    expect(lugarDeCandidato(candidato)).toEqual(
      lugarDelSelector({ nivel: "distrito", codigo: "150110", ubigeo: "150110", departamento: "Lima", provincia: "Lima", distrito: "Comas", ruta: "Comas (Lima, Lima)" }),
    );
  });

  it("arma una decisión set_value de un solo caso por columna, con las columnas correctas", () => {
    const formas = decisionesDeCorreccion({ lugar: lugarDeCandidato(candidato), roles, idCaso: "E-17", origen: "candidato" });
    expect(formas.map((f) => [f.target_variable, f.set_value])).toEqual([
      ["P2_dep", "Lima"], ["P2_prov", "Lima"], ["P2_dist", "Comas"], ["P2_ubigeo", "150110"],
    ]);
    const cuerpo = buildDecisionPayload({ form: formas[2], status: "ready", sourceId: "RC_007", sourceType: "custom_rule" });
    expect(cuerpo).toMatchObject({
      action_type: "set_value", scope: "cell_subset", target_variable: "P2_dist",
      target_case_ids: ["E-17"], action_params: { value: "Comas" }, status: "ready",
    });
  });

  it("un lugar de nivel provincia no toca distrito ni ubigeo", () => {
    const formas = decisionesDeCorreccion({
      lugar: { departamento: "Lima", provincia: "Huaral", distrito: null, ubigeo: null }, roles, idCaso: "E-17", origen: "selector",
    });
    expect(formas.map((f) => f.target_variable)).toEqual(["P2_dep", "P2_prov"]);
  });
});

// Ítem 49 (QA30b): tras confirmar, la ficha seguía con "RINAC" y la propuesta. La base no cambia hasta
// cerrar, así que la ficha dice lo corregido a partir de las decisiones guardadas del caso.
describe("correcciones ya guardadas de un caso", () => {
  const decision = (extra: Record<string, unknown>) => ({
    id: "d1", source_type: "custom_rule", source_id: "RC_007", scope: "cell_subset", target_case_ids: ["E-17"], target_variable: "P2_dist",
    action_type: "set_value", action_params: { value: "Rimac" }, rationale: "", status: "ready", created_at: "", updated_at: "", ...extra,
  }) as never;

  it("lista la columna y el valor de cada corrección lista del caso y de la regla", () => {
    const d = [
      decision({ id: "a", target_variable: "P2_dist", action_params: { value: "Rimac" } }),
      decision({ id: "b", target_variable: "P2_ubigeo", action_params: { value: "150132" } }),
    ];
    expect(correccionesGuardadas(d, "RC_007", "E-17")).toEqual([
      { columna: "P2_dist", valor: "Rimac" },
      { columna: "P2_ubigeo", valor: "150132" },
    ]);
  });

  it("no cuenta otro caso, otra regla, un borrador ni otra acción", () => {
    const d = [
      decision({ target_case_ids: ["E-18"] }),
      decision({ source_id: "RC_008" }),
      decision({ status: "draft" }),
      decision({ action_type: "ignore_rule" }),
    ];
    expect(correccionesGuardadas(d, "RC_007", "E-17")).toEqual([]);
  });
});

