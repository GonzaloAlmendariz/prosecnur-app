import { describe, expect, it } from "vitest";
import type { MonitoreoStateRule } from "../../../../../api/client";
import type { CasoDeCola } from "../../../core/colaDeInsistenciaModel";
import { chipsDeEstados, filasDeEstados, intentosDeLaCola, sinReglaDelMotor } from "./estadosModel";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";

const regla = (final_state: string, outcome_values: string[], stop_contact = false) => (
  { id: final_state, label: final_state, final_state, priority: 1, outcome_values, stop_contact } as MonitoreoStateRule
);

describe("Insumos › Estados del telefónico", () => {
  it("muestra la familia del motor junto a la del definidor y marca cuando difieren", () => {
    const filas = filasDeEstados([
      { crudo: "Efectivo", value: 222, familia: "efectivo", confirmado: false },
      { crudo: "Número suspendido", value: 31, familia: "numero_invalido", confirmado: false },
      { crudo: "Colgó / Cortó la llamada", value: 29, familia: "otro", confirmado: false },
      { crudo: "No barrido", value: 1665, familia: "sin_barrer", confirmado: false },
    ], [
      regla("complete", ["Efectivo"]),
      regla("non_effective", ["Número suspendido"]),
    ]);
    const porCrudo = Object.fromEntries(filas.map((fila) => [fila.crudo, fila]));
    expect(porCrudo.Efectivo.difiere).toBe(false);
    // El definidor lo pone en «Número inválido» y el motor lo deja en la cola.
    expect(porCrudo["Número suspendido"].motor).toBe("reintentable");
    expect(porCrudo["Número suspendido"].difiere).toBe(true);
    expect(porCrudo["Colgó / Cortó la llamada"].conRegla).toBe(false);
    expect(porCrudo["Colgó / Cortó la llamada"].difiere).toBe(false);

    const sinRegla = sinReglaDelMotor(filas);
    expect(sinRegla).toEqual({ valores: 1, casos: 29, nombres: ["Colgó / Cortó la llamada"] });
  });

  it("cuenta los intentos de la cola de uno en uno hasta cinco y agrupa los de más", () => {
    const caso = (intentos: number | null) => ({ intentos } as CasoDeCola);
    const tramos = intentosDeLaCola([caso(null), caso(1), caso(2), caso(2), caso(5), caso(7), caso(18), caso(0)]);
    expect(tramos.map((tramo) => [tramo.etiqueta, tramo.casos])).toEqual([
      ["Sin dato", 2], ["1 intento", 1], ["2 intentos", 2], ["3 intentos", 0], ["4 intentos", 0], ["5 intentos", 1],
      ["6 a 9 intentos", 1], ["10 o más", 1],
    ]);
  });

  it("sin casos de más de cinco intentos no agrega tramos vacíos", () => {
    const tramos = intentosDeLaCola([{ intentos: 3 } as CasoDeCola]);
    expect(tramos).toHaveLength(6);
  });

  it("los chips cuentan los valores de la columna Status y los que no tienen regla", () => {
    const reports = { sheets: [{ id: "monitoreo_telefonico", blocks: [{ id: "estatus_telefonico", rows: [
      { Estatus: "Efectivo", Casos: 222 }, { Estatus: "Apagado", Casos: 60 }, { Estatus: "No barrido", Casos: 1665 },
    ] }] }] } as unknown as MonitoreoAcreditacionReports;
    expect(chipsDeEstados(reports, [regla("complete", ["Efectivo"])])).toEqual([
      "3 valores en la columna Status", "1 valor sin regla, 60 casos",
    ]);
    expect(chipsDeEstados(null, [])).toEqual([]);
  });
});
