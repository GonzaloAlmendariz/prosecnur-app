import { describe, expect, it } from "vitest";
import {
  buildClassroomSelectionMap,
  normalizeSelectionMapEquivalence,
  selectionMapInspectionTarget,
} from "../classroomSelectionMapModel";

function fixture(titularCount: number, reserveDepth: number) {
  const rows: Array<Record<string, unknown>> = [];
  for (let titular = 1; titular <= titularCount; titular += 1) {
    const faculty = `Facultad ${((titular - 1) % 7) + 1}`;
    rows.push({
      classroom_id: `t-${titular}`,
      selection_slot_id: `slot-${titular}`,
      sample_role: "titular",
      wave: "M1",
      operational_code: `AULA ${titular}`,
      faculty,
    });
    for (let order = 1; order <= reserveDepth; order += 1) {
      rows.push({
        classroom_id: `r-${titular}-${order}`,
        replacement_for: `t-${titular}`,
        selection_slot_id: `slot-${titular}`,
        sample_role: "chain_reserve",
        wave: `R${order + 1}`,
        replacement_order: order,
        operational_code: `R${titular}.${order}`,
        equivalence_level: order === 1 ? "misma_celda" : order === 2 ? "celda_equivalente" : "misma_facultad",
        faculty,
      });
    }
  }
  return rows;
}

describe("buildClassroomSelectionMap", () => {
  it("conserva 175 titulares × 11 reservas completos, sin límite ni truncación", () => {
    const rows = fixture(175, 11);
    const model = buildClassroomSelectionMap(rows);

    expect(model.titularCount).toBe(175);
    expect(model.reserveCount).toBe(175 * 11);
    expect(model.maxDepth).toBe(11);
    expect(model.groups.flatMap((group) => group.chains)).toHaveLength(175);
    expect(model.groups.flatMap((group) => group.chains).every((chain) => chain.reserves.length === 11)).toBe(true);
    expect(model.virtualRows.filter((row) => row.kind === "chain")).toHaveLength(175);
  });

  it("el destino usado por el clic conserva la identidad exacta del objeto del payload", () => {
    const rows = fixture(1, 2);
    const model = buildClassroomSelectionMap(rows);
    const chain = model.groups[0].chains[0];

    expect(selectionMapInspectionTarget(chain.titular)).toBe(rows[0]);
    expect(selectionMapInspectionTarget(chain.reserves[1])).toBe(rows[2]);
  });

  it("falla cerrado: compartir facultad no crea equivalencia ni vínculo", () => {
    const titular = { classroom_id: "t-1", sample_role: "titular", wave: "M1", faculty: "Derecho" };
    const vinculadaSinNivel = { classroom_id: "r-1", replacement_for: "t-1", sample_role: "chain_reserve", faculty: "Derecho" };
    const noVinculada = { classroom_id: "r-2", sample_role: "chain_reserve", faculty: "Derecho", equivalence_level: "mismo_programa" };
    const model = buildClassroomSelectionMap([titular, vinculadaSinNivel, noVinculada]);

    expect(model.groups[0].chains[0].reserves[0].equivalence).toBe("desconocido");
    expect(model.groups[0].unlinkedReserves[0].equivalence).toBe("desconocido");
    expect(model.unlinkedReserveCount).toBe(1);
    expect(normalizeSelectionMapEquivalence("celda_cercana")).toBe("desconocido");
  });
});
