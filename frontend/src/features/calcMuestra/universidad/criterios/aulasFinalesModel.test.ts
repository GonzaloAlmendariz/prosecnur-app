import { describe, expect, it } from "vitest";
import type { CriteriosSeleccionMarco, MonitoreoRow } from "../../../../api/client";
import { aulasSupervivientesFacultad } from "../../dominio/criteriosImpacto";
import { aulaExcluida, contarExcluidas, excluirEnBloque, reactivarTodas, setAulaExcluida } from "./aulasFinalesModel";

const base: CriteriosSeleccionMarco = { byVariable: {} };

describe("aulasFinalesModel — exclusión manual", () => {
  it("excluye/incluye guardando en text_key y consulta robusta a caso/acento", () => {
    let s = setAulaExcluida(base, "NRC-123", true);
    expect(s.manualExcludedClassrooms).toEqual(["nrc_123"]);
    expect(aulaExcluida(s, "nrc 123")).toBe(true);
    expect(aulaExcluida(s, "NRC-123")).toBe(true);
    s = setAulaExcluida(s, "NRC-123", false);
    expect(s.manualExcludedClassrooms).toEqual([]);
    expect(aulaExcluida(s, "NRC-123")).toBe(false);
  });

  it("cuenta las apagadas visibles y reactiva en bloque", () => {
    let s = setAulaExcluida(setAulaExcluida(base, "A1", true), "A2", true);
    expect(contarExcluidas(s, ["a1", "a2", "a3"])).toBe(2);
    s = reactivarTodas(s, ["a1", "a2"]);
    expect(s.manualExcludedClassrooms).toEqual([]);
  });
});

describe("aulasSupervivientesFacultad", () => {
  const frame: MonitoreoRow[] = [
    { classroom_id: "A1", faculty: "Ingeniería", course_name: "Cálculo", section: "01", schedule: "L 1", teacher: "Prof X", eligible_n: 30, included: true, exclude_reason: "" },
    { classroom_id: "A2", faculty: "Ingeniería", course_name: "Física", section: "02", eligible_n: 50, included: true, exclude_reason: "" },
    // Excluida por criterio (no manual) → fuera de la lista.
    { classroom_id: "A3", faculty: "Ingeniería", course_name: "Dibujo", eligible_n: 99, included: false, exclude_reason: "session_type" },
    // Excluida SOLO a mano → sigue en la lista (para reactivar).
    { classroom_id: "A4", faculty: "Ingeniería", course_name: "Química", eligible_n: 20, included: false, exclude_reason: "manual_excluded" },
    // Otra facultad → fuera.
    { classroom_id: "B1", faculty: "Derecho", course_name: "Penal", eligible_n: 80, included: true, exclude_reason: "" },
  ];

  it("lista los supervivientes de la facultad, orden desc, con solo-manual y sin las de otras facultades ni las cortadas por criterio", () => {
    const r = aulasSupervivientesFacultad(frame, "Ingenieria"); // sin tilde: casa por text_key
    expect(r.map((a) => a.classroomId)).toEqual(["A2", "A1", "A4"]);
    expect(r[0].label).toBe("Física · 02");
    expect(r[1].label).toBe("Cálculo · 01");
    expect(r[1].detalle).toContain("L 1");
    expect(r[1].detalle).toContain("Prof X");
    expect(r[2].label).toBe("Química"); // sin sección
  });

  it("frame vacío o nulo devuelve lista vacía", () => {
    expect(aulasSupervivientesFacultad([], "Ingeniería")).toEqual([]);
    expect(aulasSupervivientesFacultad(null, "Ingeniería")).toEqual([]);
  });
});

/**
 * Pegar la lista de la DAA. En el segundo sorteo de HSVG 2026 se llevaron 120
 * cursos-horario para su estudio de IA generativa y el recorte se hizo fuera de
 * la app: apagarlos de a uno son 120 clics sobre 1.632 filas.
 */
describe("excluirEnBloque", () => {
  const marco = ["1inf46_1081", "1inf26_0881", "mat202_0591", "der101_0203", "1ind57_1031"];
  const vacia = {} as CriteriosSeleccionMarco;

  it("excluye la lista entera de un golpe", () => {
    const r = excluirEnBloque(vacia, "1inf46_1081\n1inf26_0881\nmat202_0591", marco);
    expect(r.excluidas).toHaveLength(3);
    expect(r.seleccion.manualExcludedClassrooms).toHaveLength(3);
    expect(aulaExcluida(r.seleccion, "mat202_0591")).toBe(true);
    expect(aulaExcluida(r.seleccion, "der101_0203")).toBe(false);
  });

  it("acepta lo que sale de un Excel: comas, tabuladores, punto y coma, lineas en blanco", () => {
    const r = excluirEnBloque(vacia, "1inf46_1081,\t1inf26_0881;\n\n  mat202_0591  \n", marco);
    expect(r.excluidas).toHaveLength(3);
    expect(r.desconocidas).toHaveLength(0);
  });

  it("lo que no casa con el marco se DEVUELVE, no se traga", () => {
    // Encabezado del Excel y un codigo de otro semestre. Si esto se descartara
    // en silencio, el usuario creeria haber excluido 3 habiendo excluido 1.
    const r = excluirEnBloque(vacia, "Curso-horario\n1inf46_1081\nxxx999_0000", marco);
    expect(r.excluidas).toEqual(["1inf46_1081"]);
    expect(r.desconocidas).toEqual(["Curso-horario", "xxx999_0000"]);
  });

  it("separa lo que YA estaba excluido de lo nuevo", () => {
    const antes = excluirEnBloque(vacia, "1inf46_1081", marco).seleccion;
    const r = excluirEnBloque(antes, "1inf46_1081\n1inf26_0881", marco);
    expect(r.yaEstaban).toEqual(["1inf46_1081"]);
    expect(r.excluidas).toEqual(["1inf26_0881"]);
    expect(r.seleccion.manualExcludedClassrooms).toHaveLength(2);
  });

  it("NUNCA reactiva: quien no aparece en la lista se queda como estaba", () => {
    const antes = excluirEnBloque(vacia, "der101_0203", marco).seleccion;
    const r = excluirEnBloque(antes, "1inf46_1081", marco);
    expect(aulaExcluida(r.seleccion, "der101_0203")).toBe(true);
  });

  it("un pegado sin nada util no toca la seleccion", () => {
    const antes = excluirEnBloque(vacia, "der101_0203", marco).seleccion;
    const r = excluirEnBloque(antes, "\n\n  \t ", marco);
    expect(r.seleccion).toBe(antes);
    expect(r.excluidas).toHaveLength(0);
  });

  it("no cuenta dos veces un codigo repetido en el pegado", () => {
    const r = excluirEnBloque(vacia, "1inf46_1081\n1inf46_1081\n1inf46_1081", marco);
    expect(r.excluidas).toEqual(["1inf46_1081"]);
    expect(r.seleccion.manualExcludedClassrooms).toHaveLength(1);
  });
});
