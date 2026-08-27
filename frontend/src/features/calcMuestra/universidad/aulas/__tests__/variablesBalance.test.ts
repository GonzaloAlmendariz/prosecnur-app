import { describe, expect, it } from "vitest";
import { variablesDeBalance } from "../variablesBalance";

// `balance_vars` no tenia control en la UI, y es la unica de las cuatro
// brechas de control con consecuencia medida: `program` trae 1 049 niveles en
// HSVG2026, el aterrizaje del cubo cuesta 2^columnas, y con eso el sorteo no
// terminaba. La cota de `.CM_AULAS_MAX_BALANCE_COLS` evita el cuelgue
// descartando por cardinalidad, pero elegir QUE se balancea seguia sin
// superficie: sacar `program` habia que hacerlo por API.
const filas = [
  { faculty: "DERECHO", sex_top_1: "F", size_group: "G4", program: "P1", level: "4", schedule: "L8" },
  { faculty: "DERECHO", sex_top_1: "M", size_group: "G4", program: "P2", level: "6", schedule: "M8" },
  { faculty: "DERECHO", sex_top_1: "F", size_group: "G3", program: "P3", level: "4", schedule: "J8" },
] as unknown as Parameters<typeof variablesDeBalance>[0];

describe("variablesDeBalance", () => {
  it("cuenta los niveles de cada variable declarada y dice donde esta", () => {
    const r = variablesDeBalance(filas, { balance_vars: ["faculty", "program"], spread_vars: ["schedule"] });
    const porNombre = Object.fromEntries(r.map((v) => [v.nombre, v]));
    expect(porNombre.faculty).toMatchObject({ niveles: 1, enBalance: true, enDispersion: false });
    expect(porNombre.program).toMatchObject({ niveles: 3, enBalance: true, enDispersion: false });
    expect(porNombre.schedule).toMatchObject({ niveles: 3, enBalance: false, enDispersion: true });
  });

  it("una variable sin variacion se senala: no aporta balance", () => {
    const r = variablesDeBalance(filas, { balance_vars: ["faculty"], spread_vars: [] });
    expect(r.find((v) => v.nombre === "faculty")?.constante).toBe(true);
  });

  it("no inventa variables que el marco no trae", () => {
    const r = variablesDeBalance(filas, { balance_vars: ["faculty", "no_existe"], spread_vars: [] });
    expect(r.map((v) => v.nombre)).toEqual(["faculty"]);
  });

  it("sin filas o sin config devuelve la lista vacia", () => {
    expect(variablesDeBalance([] as never, { balance_vars: ["faculty"], spread_vars: [] })).toEqual([]);
    expect(variablesDeBalance(filas, null)).toEqual([]);
  });
});
