import { describe, expect, it } from "vitest";
import type { CalcMuestraWorkspaceAulasSizeGroup } from "../../../../../api/client";
import {
  appendSizeGroup,
  cursoHorarioSexRows,
  defaultCursoHorarioFaculty,
  facultyOptionsForCursos,
  orderCursoHorarioSexRows,
  removeSizeGroup,
  renumberSizeGroups,
  sizeGroupMaxValue,
  updateSizeGroup,
} from "../cursosHorarioModel";

const aulaRows = [
  { classroom_id: "A1", faculty: "Derecho", eligible_n: 40, sex_top_1: "Hombre", sex_top_1_n: 25, sex_top_2: "Mujer", sex_top_2_n: 15 },
  { classroom_id: "A2", faculty: "Derecho", eligible_n: 18, sex_top_1: "Mujer", sex_top_1_n: 12, sex_top_2: "Hombre", sex_top_2_n: 6 },
  { classroom_id: "B1", faculty: "Ciencias", eligible_n: 30, sex_top_1: "Mujer", sex_top_1_n: 20, sex_top_2: "Hombre", sex_top_2_n: 8 },
];

describe("cursoHorarioSexRows", () => {
  it("clasifica hombres/mujeres y deriva sin dato desde elegibles", () => {
    const rows = cursoHorarioSexRows(aulaRows);
    const a1 = rows.find((r) => r.id === "A1");
    expect(a1).toBeTruthy();
    expect(a1?.hombres).toBe(25);
    expect(a1?.mujeres).toBe(15);
    expect(a1?.eligibles).toBe(40);
    expect(a1?.sinDato).toBe(0);
    const b1 = rows.find((r) => r.id === "B1");
    // 20 + 8 conocidos, 30 elegibles → 2 sin dato.
    expect(b1?.sinDato).toBe(2);
  });

  it("descarta cursos-horario sin composición ni elegibles", () => {
    const rows = cursoHorarioSexRows([{ classroom_id: "Z", faculty: "X" }]);
    expect(rows).toHaveLength(0);
  });
});

describe("selección y orden por facultad", () => {
  const rows = cursoHorarioSexRows(aulaRows);

  it("lista facultades presentes", () => {
    expect(facultyOptionsForCursos(rows)).toEqual(["Ciencias", "Derecho"]);
  });

  it("la facultad por defecto es la de más elegibles", () => {
    // Derecho: 40 + 18 = 58 > Ciencias 30.
    expect(defaultCursoHorarioFaculty(rows)).toBe("Derecho");
  });

  it("filtra por facultad y ordena por elegibles con inversión", () => {
    const desc = orderCursoHorarioSexRows(rows, "Derecho", "desc");
    expect(desc.map((r) => r.id)).toEqual(["A1", "A2"]);
    const asc = orderCursoHorarioSexRows(rows, "Derecho", "asc");
    expect(asc.map((r) => r.id)).toEqual(["A2", "A1"]);
  });

  it("facultad vacía devuelve todos los cursos-horario", () => {
    expect(orderCursoHorarioSexRows(rows, "", "desc")).toHaveLength(3);
  });
});

describe("definición de grupos de tamaño", () => {
  const base: CalcMuestraWorkspaceAulasSizeGroup[] = [
    { id: "G1", label: "G1", min: 15, max: 20, descripcion: "" },
    { id: "G2", label: "G2", min: 21, max: null, descripcion: "" },
  ];

  it("sizeGroupMaxValue trata nulo/0 como abierto por arriba", () => {
    expect(sizeGroupMaxValue(20)).toBe(20);
    expect(sizeGroupMaxValue(null)).toBe(Number.POSITIVE_INFINITY);
    expect(sizeGroupMaxValue(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("renumera y ordena por min", () => {
    const shuffled: CalcMuestraWorkspaceAulasSizeGroup[] = [
      { id: "X", label: "X", min: 30, max: null, descripcion: "" },
      { id: "Y", label: "Y", min: 10, max: 29, descripcion: "" },
    ];
    const out = renumberSizeGroups(shuffled);
    expect(out.map((g) => [g.id, g.min])).toEqual([["G1", 10], ["G2", 30]]);
  });

  it("actualiza rango saneando max >= min", () => {
    const out = updateSizeGroup(base, "G1", { max: 5 });
    expect(out[0].max).toBe(15);
  });

  it("agrega un grupo cerrando el techo abierto anterior", () => {
    const out = appendSizeGroup(base);
    expect(out).toHaveLength(3);
    // El G2 abierto se cierra y aparece un nuevo grupo abierto al final.
    expect(out.at(-1)?.max).toBeNull();
    expect(out.every((g, i) => g.id === `G${i + 1}`)).toBe(true);
  });

  it("no elimina el último grupo", () => {
    expect(removeSizeGroup([base[0]], "G1")).toHaveLength(1);
    expect(removeSizeGroup(base, "G1").map((g) => g.min)).toEqual([21]);
  });
});
