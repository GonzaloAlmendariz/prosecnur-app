import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { cambioDeUmp, cambiosDeCodigo, construirConciliacion } from "./conciliacionModel";

const CORTE = {
  enumerator_code_summary: {
    response_code_count: 42,
    recognized_code_count: 40,
    reconciled_code_count: 14,
    unrecognized_codes: [{ code: "109", raw_code: "109", normalized_code: "109", count: 2 }, { code: "P4461", raw_code: "P4461", normalized_code: "P4461", count: 1 }],
    unrecognized_responses: [
      { row_index: 1, response_id: "r1", response_id_field: "_uuid", raw_code: "109", normalized_code: "109" },
      { row_index: 2, response_id: "r2", response_id_field: "_uuid", raw_code: "109", normalized_code: "109" },
      { row_index: 3, response_id: "r3", raw_code: "P4461", normalized_code: "P4461" },
    ],
    reconciliation_entries: [{ raw_code: "P19", normalized_code: "P019", assigned_code: "P190", assigned_name: "Aplicador Uno" }],
  },
  ump_declared_summary: {
    rows: [
      { raw_ump: "UMP 1", normalized_ump: "1", response_count: 8, route_match: true, status: "recognized" },
      { raw_ump: "UMP 2 ", normalized_ump: "2", response_count: 3, route_match: true, status: "reconciled", assigned_ump: "UMP 2", assigned_district: "ATE" },
      { raw_ump: "UMP 285", normalized_ump: "285", response_count: 1, route_match: false, status: "review", response_id: "r9", response_id_field: "_uuid" },
      { raw_ump: "01900", normalized_ump: "1900", response_count: 2, route_match: false, status: "missing" },
    ],
    route_options: [{ route_ump: "UMP 28", id_manzana: "150103001000280", distrito: "ATE", ubigeo: "150103", manzana: "0280" }],
  },
} as unknown as MonitoreoTerritorialDashboard;

const STATE = {
  config: { territorial: { enumerator_roster: { assignments: [{ codigo_pulso: "P446", nombre: "Aplicadora Dos", dni: "00000000" }, { codigo_pulso: "P109", nombre: "Aplicador Tres" }] } } },
} as unknown as MonitoreoState;

describe("Control › Conciliación", () => {
  const modelo = construirConciliacion(CORTE, STATE);

  it("los códigos: en la base, reconocidos solos, conciliados y los que no se reconocen con sus respuestas", () => {
    expect(modelo.codigos).toMatchObject({ disponible: true, enBase: 42, reconocidos: 26, conciliados: 14 });
    expect(modelo.codigos.sinReconocer.map((item) => [item.codigo, item.casos, item.responseIds.length])).toEqual([["109", 2, 2], ["P4461", 1, 1]]);
    expect(modelo.codigos.conciliaciones).toEqual([{ escrito: "P19", asignado: "P190 · Aplicador Uno" }]);
  });

  it("el padrón para elegir sale ordenado y sin DNI", () => {
    expect(modelo.padron).toEqual([{ codigo: "P109", nombre: "Aplicador Tres" }, { codigo: "P446", nombre: "Aplicadora Dos" }]);
  });

  it("las UMP declaradas: valores, cuántos cruzan, conciliados y los que no cruzan", () => {
    expect(modelo.umps).toMatchObject({ disponible: true, valores: 4, cruzan: 2, conciliados: 1 });
    expect(modelo.umps.sinCruce.map((item) => item.valor)).toEqual(["UMP 285", "01900"]);
    expect(modelo.umps.conciliaciones).toEqual([{ escrito: "UMP 2 ", asignado: "UMP 2, Ate" }]);
    expect(modelo.ruta[0]).toMatchObject({ ump: "28", rotulo: "UMP 28 · Ate, manzana 0280" });
  });

  it("conciliar un código manda un cambio por respuesta, auditado", () => {
    const cambios = cambiosDeCodigo(modelo.codigos.sinReconocer[0], modelo.padron[0], "field");
    expect(cambios).toHaveLength(2);
    expect(cambios[0]).toMatchObject({ kind: "code", reconciliation: { response_id: "r1", raw_code: "109", assigned_code: "P109", scope: "response", phase: "field" } });
  });

  it("conciliar una UMP va por respuesta si la trae y por valor escrito si no", () => {
    expect(cambioDeUmp(modelo.umps.sinCruce[0], modelo.ruta[0], "field").reconciliation).toMatchObject({ response_id: "r9", scope: "response", assigned_block_id: "150103001000280", assigned_ump: "28" });
    expect(cambioDeUmp(modelo.umps.sinCruce[1], modelo.ruta[0], "field").reconciliation).toMatchObject({ scope: "ump_value", raw_ump: "01900" });
  });
});
