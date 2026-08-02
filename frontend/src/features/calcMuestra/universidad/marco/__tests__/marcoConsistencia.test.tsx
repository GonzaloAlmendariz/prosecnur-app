/**
 * Smoke SSR de la pestaña Consistencia (F4): cubre la rama con catálogo
 * (gauge de match + reconciliación + hallazgos con acción sugerida), la
 * auto-simplificación con una sola base y los alias de pestañas retiradas.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CalcMuestraAulasState,
  CalcMuestraEstudio,
  CalcMuestraWorkspace,
} from "../../../../../api/client";
import { MarcoConsistenciaTab } from "../MarcoConsistenciaTab";
import { resolveUniversityLocalTab, universitySidebarTabs } from "../../universidadTabs";

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

const estudioMinimo = {
  titulo: "",
  componentes: [],
} as unknown as CalcMuestraEstudio;

function aulasStateWithRelation(): CalcMuestraAulasState {
  return {
    frame: {
      aula_frame: [{ classroom_id: "CH-1" }],
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

function aulasStateConAudit(relationAudit?: unknown): CalcMuestraAulasState {
  return {
    frame: {
      aula_frame: [{ classroom_id: "CH-1" }],
      audit: [],
      warnings: [],
      ...(relationAudit !== undefined ? { relation_audit: relationAudit } : {}),
    },
  } as unknown as CalcMuestraAulasState;
}

function renderConsistencia(sourceMode: "base_madre" | "dos_bases" | undefined, aulasState: CalcMuestraAulasState | null) {
  const workspace = { ...baseWorkspace, source_mode: sourceMode } as CalcMuestraWorkspace;
  return renderToStaticMarkup(
    <MarcoConsistenciaTab workspace={workspace} aulasState={aulasState} />,
  );
}

function consistenciaSidebarStatus(
  sourceMode: "base_madre" | "dos_bases" | undefined,
  aulasState: CalcMuestraAulasState | null,
) {
  const workspace = { ...baseWorkspace, source_mode: sourceMode } as CalcMuestraWorkspace;
  return universitySidebarTabs({
    activeSection: "definicion",
    estudio: estudioMinimo,
    workspace,
    aulasState,
  })?.find((tab) => tab.id === "def-bases")?.status;
}

describe("MarcoConsistenciaTab", () => {
  it("con catálogo muestra llave compuesta, reconciliación y acción sugerida", () => {
    const html = renderConsistencia("dos_bases", aulasStateWithRelation());
    expect(html).toContain("cmv2-marco-gauge");
    expect(html).toContain('data-tone="danger"');
    expect(html).toContain("Llave de unión");
    expect(html).toContain("Curso + horario");
    expect(html).toContain("cmv2-marco-reconciliation");
    expect(html).toContain("Emparejados</small><strong>62");
    expect(html).toContain("Solo base principal</small><strong>38");
    expect(html).toContain("Solo 62% de los cursos-horario empatan");
    expect(html).toContain("mayúsculas, tildes o códigos");
    expect(html).toContain("La relación requiere revisión.");
    expect(html).toContain("antes de continuar a Diseño");
    expect(html).not.toContain("cmv2-marco-venn");
    expect(html).not.toContain("no hay catálogo que validar");
    expect(html).not.toContain("antes del sorteo");
    expect(html).not.toContain("aceptable");
  });

  it("con fuente única explica que la conciliación entre bases no aplica", () => {
    const html = renderConsistencia("base_madre", aulasStateConAudit());
    expect(html).toContain("Fuente única: la conciliación entre bases no aplica.");
    expect(html).not.toContain("cmv2-marco-gauge");
    expect(html).not.toContain("cmv2-marco-reconciliation");
  });

  it("sin frame pide construirlo antes de validar la consistencia", () => {
    const html = renderConsistencia("dos_bases", null);
    expect(html).toContain("Construye el marco para validar la consistencia.");
    expect(html).not.toContain("Relación acreditada.");
  });

  it("con dos bases y audit ausente no finge fuente única", () => {
    const html = renderConsistencia("dos_bases", aulasStateConAudit());
    expect(html).toContain("La conciliación no está acreditada.");
    expect(html).toContain("antes de continuar a Diseño");
    expect(html).not.toContain("Una sola base");
    expect(html).not.toContain("Fuente única");
    expect(html).not.toContain("Relación acreditada.");
  });

  it("con dos bases y used=false explica que el catálogo no fue conciliado", () => {
    const html = renderConsistencia("dos_bases", aulasStateConAudit({
      used: false,
      status: "sin_catalogo",
      issues: [],
    }));
    expect(html).toContain("El catálogo no entró en la conciliación.");
    expect(html).toContain("antes de continuar a Diseño");
    expect(html).not.toContain("Una sola base");
    expect(html).not.toContain("Fuente única");
    expect(html).not.toContain("Relación acreditada.");
  });

  it("con dos bases y status ok acredita la relación para Diseño", () => {
    const html = renderConsistencia("dos_bases", aulasStateConAudit({
      used: true,
      status: "ok",
      match_rate_classrooms: 1,
      matched_classrooms: 1,
      base_classrooms: 1,
      unmatched_base_classrooms: 0,
      catalog_only_classrooms: 0,
      issues: [],
    }));
    expect(html).toContain("Relación acreditada.");
    expect(html).toContain("El motor validó la relación entre la base principal y el catálogo. Puedes continuar a Diseño.");
    expect(html).not.toContain("aceptable");
  });

  it("explica una coincidencia sólida con revisión pendiente sin duplicar el banner del motor", () => {
    const state = aulasStateWithRelation();
    state.frame!.relation_audit = {
      ...state.frame!.relation_audit,
      match_rate_classrooms: 0.999,
      matched_classrooms: 99,
      unmatched_base_classrooms: 1,
    };
    state.frame!.warnings = ["La validacion entre base principal y catalogo curso-horario requiere revision."];
    const html = renderConsistencia("dos_bases", state);
    expect(html).toContain("cmv2-marco-gauge");
    expect(html).toContain("cmv2-marco-gauge-fill");
    expect(html).toContain("La relación requiere revisión.");
    expect(html).toContain("antes de continuar a Diseño");
    expect(html).not.toContain("Relación acreditada.");
    expect(html).not.toContain("cmv2-marco-gauge-tick");
    expect(html).not.toContain("cmv2-marco-gauge-scale");
    expect(html).not.toContain("70%");
    expect(html).not.toContain("90%");
    expect(html).not.toContain("sólido");
    expect(html).not.toContain("cmv2-frame-warning-list");
    expect(html).not.toContain("requiere revision");
  });

  it.each(["revisar", "critico", "desconocido"])(
    "status %s nunca acredita la relación",
    (status) => {
      const html = renderConsistencia("dos_bases", aulasStateConAudit({
        used: true,
        status,
        match_rate_classrooms: 1,
        matched_classrooms: 1,
        base_classrooms: 1,
        unmatched_base_classrooms: 0,
        catalog_only_classrooms: 0,
        issues: [],
      }));
      expect(html).not.toContain("Relación acreditada.");
    },
  );

  it("retira vocabulario heredado y dirige las acciones a Datos", () => {
    const html = renderConsistencia("dos_bases", aulasStateConAudit({
      used: true,
      status: "revisar",
      match_rate_classrooms: 0.9,
      matched_classrooms: 9,
      base_classrooms: 10,
      unmatched_base_classrooms: 1,
      catalog_only_classrooms: 1,
      issues: [
        {
          code: "base_sin_llave_aula",
          severity: "media",
          title: "La base no tiene llave de aula",
          detail: "Falta una llave común.",
        },
        {
          code: "catalogo_fuera_de_base",
          severity: "baja",
          title: "El catálogo tiene aulas fuera de base",
          detail: "Hay un curso-horario adicional.",
        },
      ],
    }));
    expect(html).toContain("Datos → Variables");
    expect(html).toContain("Datos → Fuentes");
    expect(html).not.toContain("Definición →");
    expect(html).not.toContain("No bloquea");
    expect(html).not.toContain("antes del sorteo");
    expect(html).not.toContain("aceptable");
  });

  it("resuelve pestañas retiradas dentro de su sección", () => {
    expect(resolveUniversityLocalTab("marco-cruces")).toBe("marco-poblacion");
    expect(resolveUniversityLocalTab("marco-estructura")).toBe("marco-poblacion");
    expect(resolveUniversityLocalTab("marco-cadena")).toBe("marco-poblacion");
    expect(resolveUniversityLocalTab("marco-validacion")).toBe("def-bases");
    expect(resolveUniversityLocalTab("def-consistencia")).toBe("def-bases");
  });

  it.each([
    {
      caso: "sin frame",
      sourceMode: "dos_bases" as const,
      aulasState: null,
      esperado: "pending",
    },
    {
      caso: "fuente única legacy",
      sourceMode: "base_madre" as const,
      aulasState: aulasStateConAudit(),
      esperado: "ready",
    },
    {
      caso: "dos bases sin audit",
      sourceMode: "dos_bases" as const,
      aulasState: aulasStateConAudit(),
      esperado: "working",
    },
    {
      caso: "dos bases en revisión",
      sourceMode: "dos_bases" as const,
      aulasState: aulasStateConAudit({ used: true, status: "revisar", issues: [] }),
      esperado: "working",
    },
    {
      caso: "dos bases acreditadas",
      sourceMode: "dos_bases" as const,
      aulasState: aulasStateConAudit({ used: true, status: "ok", issues: [] }),
      esperado: "ready",
    },
  ])("sidebar: $caso → $esperado", ({ sourceMode, aulasState, esperado }) => {
    expect(consistenciaSidebarStatus(sourceMode, aulasState)).toBe(esperado);
  });

  it("integra Consistencia dentro de Fuentes y conserva 3/6 tabs", () => {
    const fixture = {
      estudio: estudioMinimo,
      workspace: baseWorkspace,
      aulasState: null,
    };
    const datos = universitySidebarTabs({ activeSection: "definicion", ...fixture }) ?? [];
    const marco = universitySidebarTabs({ activeSection: "marco", ...fixture }) ?? [];

    expect(datos.map((tab) => tab.id)).toEqual([
      "def-estudio",
      "def-bases",
      "def-variables",
    ]);
    expect(marco.map((tab) => tab.id)).toEqual([
      "marco-criterios-alumno",
      "marco-ch-radiografia",
      "marco-alumnos-ch",
      "marco-poblacion",
      "marco-aulas",
      "marco-cobertura",
    ]);
    expect(datos.find((tab) => tab.id === "def-bases")?.targetId).toBe("cmv2-local-def-bases");
  });
});
