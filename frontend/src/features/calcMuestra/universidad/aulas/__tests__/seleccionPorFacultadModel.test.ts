// T1 del pliego: la selección por facultad con cadenas bajo su titular.
import { describe, expect, it } from "vitest";
import { seleccionPorFacultad } from "../seleccionPorFacultadModel";

describe("seleccionPorFacultad", () => {
  it("agrupa titulares por facultad y cuelga cada cadena de su titular, ordenada", () => {
    const out = seleccionPorFacultad([
      { sample_role: "titular", classroom_id: "A1", faculty: "DERECHO", orden: 2 },
      { sample_role: "titular", classroom_id: "A2", faculty: "DERECHO", orden: 1 },
      { sample_role: "chain_reserve", classroom_id: "R2", replacement_for: "A1", faculty: "DERECHO", replacement_order: 2 },
      { sample_role: "chain_reserve", classroom_id: "R1", replacement_for: "A1", faculty: "DERECHO", replacement_order: 1 },
      { sample_role: "titular", classroom_id: "B1", faculty: "PSICOLOGÍA", orden: 1 },
    ]);
    expect(out.map((f) => f.facultad)).toEqual(["DERECHO", "PSICOLOGÍA"]);
    const der = out[0];
    expect(der.titulares.map((c) => c.titular.classroom_id)).toEqual(["A2", "A1"]);
    expect(der.titulares[1].reemplazos.map((r) => r.classroom_id)).toEqual(["R1", "R2"]);
    expect(der.nReemplazos).toBe(2);
  });

  it("una reserva sin titular declarado no se inventa dueño", () => {
    const out = seleccionPorFacultad([
      { sample_role: "titular", classroom_id: "A1", faculty: "F1", orden: 1 },
      { sample_role: "extra_reserve_pool", classroom_id: "X", faculty: "F1" },
    ]);
    expect(out[0].titulares[0].reemplazos).toEqual([]);
  });
});
