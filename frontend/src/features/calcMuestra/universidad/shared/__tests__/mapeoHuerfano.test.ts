import { describe, expect, it } from "vitest";
import type { CalcMuestraWorkspace } from "../../../../../api/client";
import { universityOrphanMappings } from "../mapeoEfectivo";

/**
 * El estado que este módulo hace visible, medido en HSVG2026: su mapeo
 * confirmado apunta a columnas de una base anterior («Código PUCP») mientras
 * los archivos cargados traen ALUMNO. La pantalla decía «6 de 6 requeridas
 * confirmadas» en verde y el motor moría al reconstruir. Sustituir la columna
 * por debajo cambió los números del estudio (21.920 → 2.461 elegibles), así
 * que la respuesta correcta no es adivinar: es DECLARARLO.
 */
const COLUMNAS = ["ALUMNO", "NOMBREFAC", "SEXO", "SEMESTRE", "CLAVECURSO"];

function ws(confirmadas: Array<{ role: string; column: string }>, conColumnas = true): CalcMuestraWorkspace {
  return {
    source_mode: "base_madre",
    source_bindings: [
      {
        id: "src-base-madre",
        role: "base_madre",
        label: "Base",
        file_id: "f1",
        sheet_name: "Data",
        ...(conColumnas
          ? { sheet_diagnostics: [{ name: "Data", role: "base_madre", columns_sample: COLUMNAS }] }
          : {}),
      },
    ],
    variable_mappings: confirmadas.map((c) => ({
      role: c.role,
      label: c.role,
      required: true,
      source_role: "base_madre",
      column: c.column,
      status: "confirmada",
    })),
  } as unknown as CalcMuestraWorkspace;
}

describe("universityOrphanMappings", () => {
  it("delata la columna confirmada que ya no está en el archivo", () => {
    const huerfanos = universityOrphanMappings(ws([{ role: "student_id", column: "Código PUCP" }]), null);

    expect(huerfanos).toHaveLength(1);
    expect(huerfanos[0].role).toBe("student_id");
    expect(huerfanos[0].column).toBe("Código PUCP");
  });

  it("no delata nada cuando la columna sigue existiendo", () => {
    expect(universityOrphanMappings(ws([{ role: "faculty", column: "NOMBREFAC" }]), null)).toEqual([]);
  });

  it("calla cuando todavía no se conocen las columnas de la fuente", () => {
    // Sin evidencia no se acusa: un binding recién declarado aún no trae
    // diagnósticos de hoja.
    expect(universityOrphanMappings(ws([{ role: "student_id", column: "Código PUCP" }], false), null)).toEqual([]);
  });
});
