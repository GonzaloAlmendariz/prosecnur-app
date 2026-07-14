/**
 * Smoke SSR de la pestaña Consistencia (F4): cubre la rama con catálogo
 * (gauge de match + reconciliación + hallazgos con acción sugerida), la
 * auto-simplificación con una sola base y los alias de pestañas retiradas.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../../api/client";
import { MarcoConsistenciaTab } from "../MarcoConsistenciaTab";
import { resolveUniversityLocalTab } from "../../universidadTabs";

const baseWorkspace = {
  version: 2,
  frame_mode: "sin_definir",
  marco_disponible: "",
  fuente_marco: "",
  unidad_observacion: "",
  unidad_muestreo: "",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
} as unknown as CalcMuestraWorkspace;

function aulasStateWithRelation(): CalcMuestraAulasState {
  return {
    frame: {
      audit: [{ metric: "catalog_match_rate_classrooms", value: "0.62" }],
      relation_audit: {
        used: true,
        status: "revisar",
        match_rate_classrooms: 0.62,
        matched_classrooms: 62,
        base_classrooms: 100,
        unmatched_base_classrooms: 38,
        catalog_only_classrooms: 9,
        unmatched_base_preview: ["CIE-CH001"],
        catalog_only_preview: [],
        duplicate_catalog_preview: [],
        issues: [
          {
            code: "empate_bajo_catalogo",
            severity: "alta",
            title: "La coincidencia entre bases es baja",
            detail: "Solo 62% de las aulas empatan con el catálogo.",
          },
        ],
      },
      warnings: [],
    },
  } as unknown as CalcMuestraAulasState;
}

describe("MarcoConsistenciaTab", () => {
  it("con catálogo muestra llave compuesta, reconciliación y acción sugerida", () => {
    const workspace = { ...baseWorkspace, source_mode: "dos_bases" } as CalcMuestraWorkspace;
    const html = renderToStaticMarkup(
      <MarcoConsistenciaTab workspace={workspace} aulasState={aulasStateWithRelation()} />,
    );
    expect(html).toContain("cmv2-marco-gauge");
    expect(html).toContain('data-tone="danger"');
    expect(html).toContain("Llave de unión");
    expect(html).toContain("Curso + horario");
    expect(html).toContain("cmv2-marco-reconciliation");
    expect(html).toContain("Emparejados</small><strong>62");
    expect(html).toContain("Solo base principal</small><strong>38");
    expect(html).toContain("Solo 62% de los cursos-horario empatan");
    expect(html).toContain("mayúsculas, tildes o códigos");
    expect(html).not.toContain("cmv2-marco-venn");
    expect(html).not.toContain("no hay catálogo que validar");
  });

  it("con una sola base se auto-simplifica sin gauge ni conjuntos", () => {
    const workspace = { ...baseWorkspace, source_mode: "base_madre" } as CalcMuestraWorkspace;
    const state = { frame: { audit: [], warnings: [] } } as unknown as CalcMuestraAulasState;
    const html = renderToStaticMarkup(
      <MarcoConsistenciaTab workspace={workspace} aulasState={state} />,
    );
    expect(html).toContain("Una sola base: no hay catálogo que validar");
    expect(html).not.toContain("cmv2-marco-gauge");
    expect(html).not.toContain("cmv2-marco-reconciliation");
  });

  it("explica una coincidencia sólida con revisión pendiente sin duplicar el banner del motor", () => {
    const workspace = { ...baseWorkspace, source_mode: "dos_bases" } as CalcMuestraWorkspace;
    const state = aulasStateWithRelation();
    state.frame!.relation_audit = {
      ...state.frame!.relation_audit,
      match_rate_classrooms: 0.999,
      matched_classrooms: 99,
      unmatched_base_classrooms: 1,
    };
    state.frame!.warnings = ["La validacion entre base principal y catalogo curso-horario requiere revision."];
    const html = renderToStaticMarkup(
      <MarcoConsistenciaTab workspace={workspace} aulasState={state} />,
    );
    expect(html).toContain("Coincidencia sólida; hay calidad del catálogo por revisar");
    expect(html).not.toContain("cmv2-frame-warning-list");
    expect(html).not.toContain("requiere revision");
  });

  it("resuelve pestañas retiradas hacia marco-poblacion", () => {
    expect(resolveUniversityLocalTab("marco-cruces")).toBe("marco-poblacion");
    expect(resolveUniversityLocalTab("marco-estructura")).toBe("marco-poblacion");
    expect(resolveUniversityLocalTab("marco-cadena")).toBe("marco-poblacion");
    expect(resolveUniversityLocalTab("marco-validacion")).toBe("marco-validacion");
  });
});
