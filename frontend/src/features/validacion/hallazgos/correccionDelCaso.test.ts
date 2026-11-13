import { describe, expect, it } from "vitest";
import { buildDecisionPayload } from "../limpieza/modeloLimpieza";
import type { CandidatoDeCatalogo } from "../../../api/validacionAuditoria";
import {
  columnasDeRoles,
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
