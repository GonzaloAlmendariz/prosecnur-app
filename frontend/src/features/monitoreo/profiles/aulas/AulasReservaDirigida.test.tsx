import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasReservaDirigida } from "./AulasReservaDirigida";
import type {
  MonitoreoAulasCandidatoDirigido,
  MonitoreoAulasReservaDirigida,
} from "../../../../api/monitoreo";

const cand = (id: string, p: Partial<MonitoreoAulasCandidatoDirigido> = {}) =>
  ({
    classroom_id: id, faculty: "DERECHO", sexo: "F",
    elegibles_del_sexo: 20, solape_estimado: 1, aporte_esperado: 11,
    tasa_efectividad: 0.55, solape_medible: true,
    motivo: "Aporta 11 de 20 a la cuota de F de DERECHO",
    ...p,
  }) as MonitoreoAulasCandidatoDirigido;

const celda = (p: Partial<MonitoreoAulasReservaDirigida> = {}) =>
  ({
    faculty: "DERECHO", sex: "F", brecha: 12, candidatos: [cand("R 7")],
    aporte_de_los_candidatos: 11, alcanza: false,
    etiqueta: "El banco no alcanza: sus 1 aula aportan 11 y faltan 12",
    ...p,
  }) as MonitoreoAulasReservaDirigida;

const html = (celdas: MonitoreoAulasReservaDirigida[]) =>
  renderToStaticMarkup(<AulasReservaDirigida celdas={celdas} />);

describe("AulasReservaDirigida", () => {
  it("no ocupa sitio cuando no hay decision que tomar", () => {
    expect(html([])).toBe("");
  });

  it("tampoco con celdas sin brecha: un «todo bien» compite por la atencion", () => {
    expect(html([celda({ brecha: 0 })])).toBe("");
  });

  it("proyecta la frase del motor sin reescribirla", () => {
    const out = html([celda()]);
    expect(out).toContain("El banco no alcanza: sus 1 aula aportan 11 y faltan 12");
    expect(out).toContain("R 7");
    expect(out).toContain("Aporta 11 de 20");
  });

  it("nombra el sexo en palabras, que es como se lee la cuota", () => {
    const out = html([celda({ sex: "F" }), celda({ faculty: "LETRAS", sex: "M" })]);
    expect(out).toContain("mujeres");
    expect(out).toContain("hombres");
  });

  it("la celda que el banco NO cierra va primero", () => {
    // El orden es la decision: la que no se cierra obliga a algo distinto que
    // activar una reserva, y en una lista larga se perdia entre las que si.
    const out = html([
      celda({ faculty: "SI CIERRA", alcanza: true, brecha: 40 }),
      celda({ faculty: "NO CIERRA", alcanza: false, brecha: 2 }),
    ]);
    expect(out.indexOf("NO CIERRA")).toBeLessThan(out.indexOf("SI CIERRA"));
    expect(out.indexOf('data-alcanza="no"')).toBeLessThan(out.indexOf('data-alcanza="si"'));
  });

  it("marca el solape estimado, que no es lo mismo que medido", () => {
    const out = html([celda({ candidatos: [cand("R 1"), cand("R 2", { solape_medible: false })] })]);
    expect(out.match(/solape estimado/g) ?? []).toHaveLength(1);
  });

  it("una celda sin candidatos sigue apareciendo: es la que mas obliga", () => {
    const out = html([celda({
      candidatos: [], aporte_de_los_candidatos: 0,
      etiqueta: "El banco no tiene aulas de esa facultad y ese sexo",
    })]);
    expect(out).toContain("El banco no tiene aulas de esa facultad y ese sexo");
  });

  it("declara su geometria: sin C1 el gate no la mira", () => {
    const out = html([celda()]);
    expect(out).toContain('data-qa-geometry-group="aulas-reserva-dirigida"');
    expect(out).toContain('data-qa-geometry-contract="intrinsic"');
  });

  it("EL CASO QUE JUSTIFICA LA SUPERFICIE: el agregado dice que alcanzan y la celda no", () => {
    // `reservas_alcanzan` es por FACULTAD; esto es por facultad×sexo. Una
    // facultad con banco de sobra puede tener su celda de mujeres sin una sola
    // aula util, porque las del banco son de composicion masculina. El total no
    // compensa lo que no se compensa entre celdas, y hasta ahora la pantalla
    // solo ensenaba el total.
    const out = html([
      celda({ sex: "M", alcanza: true, brecha: 5,
              etiqueta: "Con 2 aulas del banco se cierra: aportan 9 y faltan 5" }),
      celda({ sex: "F", alcanza: false, brecha: 30, candidatos: [],
              etiqueta: "El banco no tiene aulas de esa facultad y ese sexo" }),
    ]);
    // La que no se cierra manda, y dice de que celda habla y cuanto falta.
    expect(out.indexOf("faltan 30")).toBeLessThan(out.indexOf("faltan 5"));
    expect(out.indexOf("mujeres")).toBeLessThan(out.indexOf("hombres"));
  });
});
