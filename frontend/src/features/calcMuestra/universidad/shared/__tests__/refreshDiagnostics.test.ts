import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasFileInspection,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../../api/client";
import {
  applyRefreshedDiagnostics,
  mergeRefreshedSheetDiagnostics,
  sourceBindingsPendingInspection,
} from "../refreshDiagnostics";

// Encabezados COMPLETOS de la hoja del catálogo (19). La última, "Tipo de docente",
// es la que se pierde sistemáticamente en el sample stale (18/19) del bug ADR 0035.
const columns19 = [
  "Facultad",
  "Escuela",
  "Curso",
  "Sección",
  "Docente",
  "Aula",
  "Turno",
  "Modalidad",
  "Ciclo",
  "Créditos",
  "Horario",
  "Día",
  "Hora inicio",
  "Hora fin",
  "Matriculados",
  "Capacidad",
  "Sede",
  "Campus",
  "Tipo de docente",
];
const columns18 = columns19.slice(0, 18);

function bindingConSampleStale(fileId: string): CalcMuestraWorkspaceSourceBinding {
  return {
    id: "src-catalogo",
    role: "catalogo_curso_horario",
    label: "Catálogo curso-horario",
    file_id: fileId,
    file_name: "catalogo.xlsx",
    sheet_name: "Catalogo",
    detected_role: "catalogo_curso_horario",
    available_sheets: ["Catalogo"],
    sheet_diagnostics: [
      { name: "Catalogo", columns: 18, columns_sample: columns18, role: "catalogo_curso_horario" },
    ],
  };
}

function inspeccionCompleta(): CalcMuestraAulasFileInspection {
  return {
    type: "workbook",
    suggested_sheet: "Catalogo",
    suggested_role: "catalogo_curso_horario",
    sheets: [
      { name: "Catalogo", columns: 19, columns_sample: columns19, role: "catalogo_curso_horario" },
    ],
  };
}

describe("mergeRefreshedSheetDiagnostics", () => {
  it("reemplaza los diagnostics stale (18) por el set completo (19) preservando hoja y rol", () => {
    const binding = bindingConSampleStale("file-abc");
    const merged = mergeRefreshedSheetDiagnostics(binding, inspeccionCompleta());
    const sample = merged.sheet_diagnostics?.[0]?.columns_sample ?? [];
    expect(sample).toHaveLength(19);
    expect(sample).toContain("Tipo de docente");
    // No se pierde la elección del usuario.
    expect(merged.sheet_name).toBe("Catalogo");
    expect(merged.role).toBe("catalogo_curso_horario");
    expect(merged.detected_role).toBe("catalogo_curso_horario");
  });

  it("es best-effort: sin hojas en la inspección deja el binding intacto", () => {
    const binding = bindingConSampleStale("file-abc");
    const merged = mergeRefreshedSheetDiagnostics(binding, { sheets: [] });
    expect(merged.sheet_diagnostics?.[0]?.columns_sample).toHaveLength(18);
    expect(merged).toBe(binding);
  });
});

describe("sourceBindingsPendingInspection (anti-loop)", () => {
  it("devuelve el file_id la primera vez y nada tras marcarlo como inspeccionado", () => {
    const binding = bindingConSampleStale("file-abc");
    const already = new Set<string>();

    const first = sourceBindingsPendingInspection([binding], already);
    expect(first).toEqual(["file-abc"]);

    // Simula el efecto marcando el file_id antes de re-render con diagnostics frescos.
    already.add("file-abc");
    const merged = mergeRefreshedSheetDiagnostics(binding, inspeccionCompleta());
    const second = sourceBindingsPendingInspection([merged], already);
    expect(second).toEqual([]);
  });

  it("ignora bindings sin file_id y deduplica archivos repetidos", () => {
    const withFile = bindingConSampleStale("file-shared");
    const sameFile: CalcMuestraWorkspaceSourceBinding = { ...withFile, id: "src-2", role: "estudiantes" };
    const noFile: CalcMuestraWorkspaceSourceBinding = {
      id: "src-3",
      role: "base_madre",
      label: "Sin archivo",
    };
    const pending = sourceBindingsPendingInspection([withFile, sameFile, noFile], new Set());
    expect(pending).toEqual(["file-shared"]);
  });
});

describe("applyRefreshedDiagnostics", () => {
  it("refresca solo las bindings con inspección disponible", () => {
    const catalogo = bindingConSampleStale("file-abc");
    const otra: CalcMuestraWorkspaceSourceBinding = {
      id: "src-madre",
      role: "base_madre",
      label: "Base madre",
      file_id: "file-sin-inspeccion",
      sheet_diagnostics: [{ name: "Hoja1", columns: 5, columns_sample: ["a", "b", "c", "d", "e"] }],
    };
    const inspections = new Map([["file-abc", inspeccionCompleta()]]);
    const [nextCatalogo, nextOtra] = applyRefreshedDiagnostics([catalogo, otra], inspections);
    expect(nextCatalogo.sheet_diagnostics?.[0]?.columns_sample).toHaveLength(19);
    expect(nextOtra).toBe(otra);
  });
});
