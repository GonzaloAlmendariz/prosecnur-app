import { describe, expect, it } from "vitest";
import type { CriteriosSeleccionMarco, MonitoreoRow } from "../../../../api/client";
import { aulasSupervivientesFacultad } from "../../dominio/criteriosImpacto";
import { aulaExcluida, contarExcluidas, reactivarTodas, setAulaExcluida } from "./aulasFinalesModel";

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
