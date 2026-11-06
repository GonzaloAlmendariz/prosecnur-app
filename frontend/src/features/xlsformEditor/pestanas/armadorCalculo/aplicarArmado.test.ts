// Mata: el número al azar escrito después del cálculo que lo usa, un nombre ajeno pisado, y un sorteo que vuelve a
// insertar su azar cada vez que se aplica.
import { describe, expect, test } from "vitest";
import { createBlankWorkbook, insertRecord, rowToRecord } from "../../parsing/sheetUtils";
import { aplicarArmado } from "./aplicarArmado";

function libro() {
  const wb = createBlankWorkbook();
  wb.survey.rows = [];
  insertRecord(wb.survey, 0, { type: "integer", name: "edad", label: "Edad" });
  insertRecord(wb.survey, 1, { type: "calculate", name: "grupo", calculation: "" });
  return wb;
}
const filas = (wb: ReturnType<typeof libro>) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i));

describe("aplicar lo armado", () => {
  test("escribe la fórmula en la fila del cálculo", () => {
    const wb = libro();
    expect(aplicarArmado(wb, 1, "if(${edad} < 18, 'menor', 'adulto')", [])).toEqual({ ok: true, filaCalculo: 1 });
    expect(filas(wb)[1]!.calculation).toBe("if(${edad} < 18, 'menor', 'adulto')");
  });

  test("el azar del sorteo entra antes del cálculo y no se duplica al reaplicar", () => {
    const wb = libro();
    const aux = [{ name: "azar_grupo", calculation: "once(random())" }];
    expect(aplicarArmado(wb, 1, "if(int(${azar_grupo} * 2) = 0, 'A', 'B')", aux)).toEqual({ ok: true, filaCalculo: 2 });
    expect(filas(wb).map((f) => f.name)).toEqual(["edad", "azar_grupo", "grupo"]);
    expect(filas(wb)[1]!.type).toBe("calculate");
    expect(aplicarArmado(wb, 2, "if(${azar_grupo} < 0.3, 'A', 'B')", aux)).toEqual({ ok: true, filaCalculo: 2 });
    expect(filas(wb)).toHaveLength(3);
  });

  test("un nombre que ya usa otra fila no se pisa", () => {
    const wb = libro();
    const r = aplicarArmado(wb, 1, "x", [{ name: "edad", calculation: "once(random())" }]);
    expect(r.ok).toBe(false);
    expect(filas(wb)[1]!.calculation).toBe("");
  });
});
