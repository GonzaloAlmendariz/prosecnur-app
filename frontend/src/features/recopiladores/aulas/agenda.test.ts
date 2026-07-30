// `calcSelectionAgenda` es la costura entre el motor muestral y la operación de
// campo. Lo que se fija acá es la lectura por alias —el motor renombró columnas
// más de una vez— y las dos decisiones que no son obvias: de dónde sale el rol
// cuando no viene, y por qué el estado operativo arranca en "pendiente".

import { describe, expect, it } from "vitest";
import type { CalcMuestraState, MonitoreoAulasPlanRow } from "../../../api/client";
import { buildPackageOutputGroups, calcSelectionAgenda, facultyOptions } from "./agenda";

const estado = (rows: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
  ({ aulas: { selection: { selection: rows, selection_run_id: "run-1", generated_at: "2026-07-29", ...extra } } }) as unknown as CalcMuestraState;

describe("calcSelectionAgenda", () => {
  it("devuelve vacío sin selección", () => {
    expect(calcSelectionAgenda(null)).toEqual([]);
    expect(calcSelectionAgenda({} as CalcMuestraState)).toEqual([]);
  });

  it("lee los nombres nuevos y los viejos de la misma columna", () => {
    const [nuevo] = calcSelectionAgenda(estado([{ classroom_id: "A-1", course_name: "Cálculo", schedule: "0404" }]));
    expect(nuevo).toMatchObject({ classroom_id: "A-1", course_name: "Cálculo", schedule: "0404" });

    const [viejo] = calcSelectionAgenda(estado([{ curso_horario: "A-1", nombre_del_curso: "Cálculo", horario: "0404" }]));
    expect(viejo).toMatchObject({ classroom_id: "A-1", course_name: "Cálculo", schedule: "0404" });
  });

  it("deriva el rol de la ola cuando la fila no lo trae", () => {
    const [titular] = calcSelectionAgenda(estado([{ classroom_id: "A-1", wave: "M1" }]));
    expect(titular.sample_role).toBe("titular");

    const [reserva] = calcSelectionAgenda(estado([{ classroom_id: "A-2", wave: "R1" }]));
    expect(reserva.sample_role).toBe("chain_reserve");
  });

  it("asume M1 cuando no hay ola", () => {
    const [row] = calcSelectionAgenda(estado([{ classroom_id: "A-1" }]));
    expect(row.wave).toBe("M1");
    expect(row.sample_role).toBe("titular");
  });

  it("arranca sin estado de campo", () => {
    // Una selección recién hecha no tiene avance. Heredar cualquier otro estado
    // afirmaría un trabajo de campo que no ocurrió.
    const [row] = calcSelectionAgenda(estado([{ classroom_id: "A-1", operational_status: "aplicada" }]));
    expect(row.operational_status).toBe("pendiente");
  });

  it("propaga la identidad de la corrida a cada fila", () => {
    const [row] = calcSelectionAgenda(estado([{ classroom_id: "A-1" }]));
    expect(row.selection_run_id).toBe("run-1");
    expect(row.updated_at).toBe("2026-07-29");
  });

  it("inventa un id estable cuando la fila no tiene ninguno", () => {
    const rows = calcSelectionAgenda(estado([{}, {}]));
    expect(rows.map((r) => r.classroom_id)).toEqual(["aula-1", "aula-2"]);
    expect(rows.map((r) => r.orden)).toEqual([1, 2]);
  });
});

describe("facultyOptions", () => {
  it("deduplica y ordena en español", () => {
    const rows = [{ faculty: "Ñandú" }, { faculty: "Arte" }, { faculty: "Arte" }, {}] as MonitoreoAulasPlanRow[];
    expect(facultyOptions(rows)).toEqual(["Arte", "Ñandú", "Sin facultad"]);
  });
});

describe("buildPackageOutputGroups", () => {
  it("agrupa por bloque de reparto y suma estudiantes", () => {
    const rows = [
      { wave: "M1", link: "https://x/1", eligible_n: 20 },
      { wave: "M1", eligible_n: 10 },
      { wave: "R1", link: "https://x/2", eligible_n: 5 },
    ] as MonitoreoAulasPlanRow[];
    const groups = buildPackageOutputGroups(rows);
    expect(groups.map((g) => g.label)).toEqual(["M1", "R1"]);
    expect(groups[0]).toMatchObject({ total: 2, linked: 1, missing: 1, students: 30, ready: false });
    expect(groups[1]).toMatchObject({ total: 1, linked: 1, missing: 0, students: 5, ready: true });
  });

  it("no declara listo un grupo vacío", () => {
    expect(buildPackageOutputGroups([])).toEqual([]);
  });

  it("cuenta como con QR la fila que solo tiene enlace", () => {
    // Con enlace el QR se genera; no hace falta que esté guardado.
    const [group] = buildPackageOutputGroups([{ wave: "M1", link: "https://x/1" }] as MonitoreoAulasPlanRow[]);
    expect(group.qr).toBe(1);
  });
});
