import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspaceAulasConfig,
  CriteriosSeleccionMarco,
} from "../../../../../api/client";
import {
  evaluarConsistenciaMarco,
  marcoCriteriosDesactualizado,
  type MarcoConfigVigente,
} from "../frame";

// La selección que el frame ECHA desde el backend viene verbosa (fromValue "NA",
// layer null, threshold {}, includeValues [], exceptions []); la del frontend es
// lean. No deben leerse como "desactualizado" si el contenido con significado es
// el mismo — si no, la franja queda en "reconstruye" para siempre tras sanear.
const teacherBackend = {
  scope: "aula",
  kind: "hierarchical",
  mode: "include",
  match: "any",
  categories: ["docente_contratado_contratado", "docente_ordinario_principal"],
  exceptions: [],
  threshold: {},
  includeValues: [],
  fromValue: "NA",
  layer: null,
};
const teacherLean = {
  mode: "include",
  match: "any",
  categories: ["docente_contratado_contratado", "docente_ordinario_principal"],
};

function frameCon(sel: unknown): CalcMuestraAulasState["frame"] {
  return { criterios_seleccion: { byVariable: { teacher_type: sel } } } as unknown as CalcMuestraAulasState["frame"];
}

describe("marcoCriteriosDesactualizado", () => {
  it("verbose del backend vs lean del frontend con el mismo contenido → NO desactualizado", () => {
    const config = { byVariable: { teacher_type: teacherLean } } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCon(teacherBackend), config)).toBe(false);
  });

  it("categorías realmente distintas → SÍ desactualizado", () => {
    const config = {
      byVariable: { teacher_type: { ...teacherLean, categories: ["docente_contratado_contratado"] } },
    } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCon(teacherBackend), config)).toBe(true);
  });

  it("frame sin selección registrada → no afirma desactualizado", () => {
    const config = { byVariable: { teacher_type: teacherLean } } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCon(undefined) && ({} as CalcMuestraAulasState["frame"]), config)).toBe(false);
    expect(marcoCriteriosDesactualizado(null, config)).toBe(false);
  });

  it("fromValue real distinto de 'NA' sí cuenta como cambio", () => {
    const frameCiclo = frameCon({ mode: "include", includeValues: [], fromValue: 3 });
    const configCiclo = { byVariable: { teacher_type: { mode: "include", fromValue: "NA" } } } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameCiclo, configCiclo)).toBe(true);
  });

  it("match:'any' del backend vs config lean sin match → NO desactualizado (caso real HST_UNSA2)", () => {
    // El motor estampa match:"any" en TODA variable flat (formation, condition…);
    // normalizeUniversityAulasConfig no lleva match. Antes esto quedaba en
    // "reconstruye" perpetuo por comparar "any" contra ausente.
    const frameFlat = frameCon({
      scope: "alumno", kind: "flat", mode: "include", match: "any",
      categories: "pregrado", exceptions: [], threshold: null,
      includeValues: [], fromValue: "NA", layer: "marco",
    });
    const configFlat = {
      byVariable: { teacher_type: { mode: "include", categories: ["pregrado"], layer: "marco" } },
    } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameFlat, configFlat)).toBe(false);
  });

  it("match:'all' (no-default) sí se compara: 'all' en frame vs config sin match → SÍ desactualizado", () => {
    const frameAll = frameCon({ mode: "include", match: "all", categories: ["a", "b"] });
    const configAny = {
      byVariable: { teacher_type: { mode: "include", categories: ["a", "b"] } },
    } as unknown as CriteriosSeleccionMarco;
    expect(marcoCriteriosDesactualizado(frameAll, configAny)).toBe(true);
  });
});

// ADR 0035: reordenar la jerarquía de docente reetiqueta el teacher_type_top de
// cada curso-horario, así que el marco vigente queda obsoleto. El frame guarda el
// orden EFECTIVO con que se construyó (frame.teacher_type_orden).
function frameConOrden(orden: unknown): CalcMuestraAulasState["frame"] {
  return { teacher_type_orden: orden } as unknown as CalcMuestraAulasState["frame"];
}

describe("marcoCriteriosDesactualizado — orden de jerarquía de docente", () => {
  const sinCriterios = null;

  it("mismo orden ⇒ NO desactualizado", () => {
    const orden = ["ordinario_principal", "ordinario_asociado", "contratado"];
    expect(marcoCriteriosDesactualizado(frameConOrden(orden), sinCriterios, [...orden])).toBe(false);
  });

  it("orden distinto ⇒ SÍ desactualizado", () => {
    const frameOrden = ["ordinario_principal", "ordinario_asociado", "contratado"];
    const configOrden = ["contratado", "ordinario_principal", "ordinario_asociado"];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, configOrden)).toBe(true);
  });

  it("distinta cantidad de tipos ⇒ SÍ desactualizado", () => {
    const frameOrden = ["ordinario_principal", "contratado"];
    const configOrden = ["ordinario_principal", "ordinario_asociado", "contratado"];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, configOrden)).toBe(true);
  });

  it("frame sin el campo (marco viejo) ⇒ NO desactualizado aunque el config tenga orden", () => {
    const frameViejo = { criterios_seleccion: { byVariable: {} } } as unknown as CalcMuestraAulasState["frame"];
    expect(marcoCriteriosDesactualizado(frameViejo, sinCriterios, ["contratado", "ordinario_principal"])).toBe(false);
  });

  it("config sin orden (el usuario nunca reordenó) ⇒ NO desactualizado aunque el frame guarde el orden por defecto", () => {
    // Caso real HST_UNSA2: el motor guarda el orden efectivo (8 tipos por defecto)
    // pero el workspace no tiene teacher_type_orden. [] vs 8 no es un cambio real.
    const frameOrden = [
      "docente_ordinario_principal",
      "docente_ordinario_asociado",
      "docente_ordinario_auxiliar",
      "docente_ordinario",
      "docente_contratado",
      "docente_extraordinario",
      "pre_docente",
      "jefe_de_practica",
    ];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, undefined)).toBe(false);
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, [])).toBe(false);
  });

  it("compara semánticamente: dedup y trim no cuentan como cambio", () => {
    const frameOrden = ["ordinario_principal", "contratado"];
    const configOrden = [" ordinario_principal ", "contratado", "contratado", ""];
    expect(marcoCriteriosDesactualizado(frameConOrden(frameOrden), sinCriterios, configOrden)).toBe(false);
  });
});

// T2 — frescura del criterio 8 (composición del aula) vía frame.filters_echo:
// el backend ecoa los filtros normalizados con que construyó el marco; se
// comparan contra el payload EFECTIVO vigente (aulas_config ∪ opcionales
// c7/c8 del Motor, con la misma derivación del build).
function frameConEco(eco: Record<string, unknown> | undefined): CalcMuestraAulasState["frame"] {
  return { ...(eco !== undefined ? { filters_echo: eco } : {}) } as unknown as CalcMuestraAulasState["frame"];
}

/** Config mínimo con la suite de criterios ACTIVA (byVariable no vacío). */
function configSuiteActiva(extra: Record<string, unknown> = {}): CalcMuestraWorkspaceAulasConfig {
  return {
    criterios_seleccion: { byVariable: { formation: { mode: "include", categories: ["pregrado"] } } },
    ...extra,
  } as unknown as CalcMuestraWorkspaceAulasConfig;
}

const ecoApagado = {
  require_min_prevalence: false,
  min_prevalence_pct: 0.8,
  require_faculty_prevalence: false,
  min_faculty_prevalence_pct: 0.8,
  require_cycle_homogeneity: false,
  min_cycle_homogeneity_pct: 0.8,
};

describe("marcoCriteriosDesactualizado — filters_echo (criterio 8)", () => {
  it("marco viejo sin filters_echo ⇒ NUNCA desactualizado por esta vía (guard de compatibilidad)", () => {
    const vigente: MarcoConfigVigente = {
      config: configSuiteActiva({ require_cycle_homogeneity: true }),
    };
    expect(marcoCriteriosDesactualizado(frameConEco(undefined), null, null, vigente)).toBe(false);
  });

  it("sin config vigente (call sites actuales) ⇒ comportamiento previo intacto", () => {
    expect(marcoCriteriosDesactualizado(frameConEco(ecoApagado), null, null)).toBe(false);
    expect(marcoCriteriosDesactualizado(frameConEco(ecoApagado), null, null, null)).toBe(false);
  });

  it("eco apagado + tarjeta enciende require_cycle_homogeneity ⇒ SÍ desactualizado", () => {
    const vigente: MarcoConfigVigente = {
      config: configSuiteActiva({ require_cycle_homogeneity: true, min_cycle_homogeneity_pct: 0.8 }),
    };
    expect(marcoCriteriosDesactualizado(frameConEco(ecoApagado), null, null, vigente)).toBe(true);
  });

  it("eco apagado + tarjeta apagada pero el opcional c8 del Motor está activo ⇒ SÍ desactualizado", () => {
    const vigente: MarcoConfigVigente = {
      config: configSuiteActiva(),
      opcionalesActivos: ["c8"],
    };
    expect(marcoCriteriosDesactualizado(frameConEco(ecoApagado), null, null, vigente)).toBe(true);
  });

  it("eco apagado + opcional c7 del Motor activo ⇒ SÍ desactualizado (prevalencia referencial)", () => {
    const vigente: MarcoConfigVigente = {
      config: configSuiteActiva(),
      opcionalesActivos: ["c7"],
    };
    expect(marcoCriteriosDesactualizado(frameConEco(ecoApagado), null, null, vigente)).toBe(true);
  });

  it("flag encendido en ambos lados: mismo umbral ⇒ NO; umbral distinto ⇒ SÍ", () => {
    const eco = { ...ecoApagado, require_faculty_prevalence: true, min_faculty_prevalence_pct: 0.8 };
    const igual: MarcoConfigVigente = {
      config: configSuiteActiva({ require_faculty_prevalence: true, min_faculty_prevalence_pct: 0.8 }),
    };
    const distinto: MarcoConfigVigente = {
      config: configSuiteActiva({ require_faculty_prevalence: true, min_faculty_prevalence_pct: 0.7 }),
    };
    expect(marcoCriteriosDesactualizado(frameConEco(eco), null, null, igual)).toBe(false);
    expect(marcoCriteriosDesactualizado(frameConEco(eco), null, null, distinto)).toBe(true);
  });

  it("flag apagado en ambos lados: el umbral NO cuenta (no filtra nada)", () => {
    const eco = { ...ecoApagado, min_cycle_homogeneity_pct: 0.6 };
    const vigente: MarcoConfigVigente = {
      config: configSuiteActiva({ require_cycle_homogeneity: false, min_cycle_homogeneity_pct: 0.9 }),
    };
    expect(marcoCriteriosDesactualizado(frameConEco(eco), null, null, vigente)).toBe(false);
  });

  it("suite INACTIVA ahora (payload permisivo) vs marco construido con c8 encendido ⇒ SÍ desactualizado", () => {
    const eco = { ...ecoApagado, require_cycle_homogeneity: true };
    const vigente: MarcoConfigVigente = {
      // Sin criterios definidos: el build actual viajaría permisivo.
      config: { criterios_seleccion: { byVariable: {} } } as unknown as CalcMuestraWorkspaceAulasConfig,
      opcionalesActivos: ["c8"],
    };
    expect(marcoCriteriosDesactualizado(frameConEco(eco), null, null, vigente)).toBe(true);
  });

  it("eco parcial/corrupto en una pareja ⇒ esa pareja no se compara (defensivo)", () => {
    const eco = { require_cycle_homogeneity: "TRUE", min_cycle_homogeneity_pct: 0.8 };
    const vigente: MarcoConfigVigente = {
      config: configSuiteActiva({ require_cycle_homogeneity: true }),
    };
    expect(marcoCriteriosDesactualizado(frameConEco(eco), null, null, vigente)).toBe(false);
  });
});

function frameListoConsistencia({
  relationAudit,
  catalogAudit,
}: {
  relationAudit?: unknown;
  catalogAudit?: unknown;
} = {}): CalcMuestraAulasState["frame"] {
  return {
    aula_frame: [{ classroom_id: "CH-1" }],
    ...(relationAudit !== undefined ? { relation_audit: relationAudit } : {}),
    ...(catalogAudit !== undefined ? { catalog_audit: catalogAudit } : {}),
  } as unknown as CalcMuestraAulasState["frame"];
}

describe("evaluarConsistenciaMarco — gate de relation_audit", () => {
  const guia = [
    {
      caso: "sin frame",
      sourceMode: "dos_bases",
      frame: null,
      esperado: "pending",
    },
    {
      caso: "base madre legacy sin audit",
      sourceMode: "base_madre",
      frame: frameListoConsistencia(),
      esperado: "ready",
    },
    {
      caso: "base madre sin catálogo, audit coherente y sin issues",
      sourceMode: "base_madre",
      frame: frameListoConsistencia({
        relationAudit: { used: false, status: "sin_catalogo", issues: [] },
      }),
      esperado: "ready",
    },
    {
      caso: "base madre con issue contradictorio",
      sourceMode: "base_madre",
      frame: frameListoConsistencia({
        relationAudit: {
          used: false,
          status: "sin_catalogo",
          issues: [{ code: "base_sin_llave_aula" }],
        },
      }),
      esperado: "working",
    },
    ...["ok", "revisar", "critico", "pendiente", "sin_catalogo", "desconocido"].map((status) => ({
      caso: `base madre con used=true/status=${status}`,
      sourceMode: "base_madre",
      frame: frameListoConsistencia({ relationAudit: { used: true, status, issues: [] } }),
      esperado: "working",
    })),
    {
      caso: "dos bases sin relation_audit aunque exista catalog_audit legacy",
      sourceMode: "dos_bases",
      frame: frameListoConsistencia({
        catalogAudit: { used: true, matched_classrooms: 1, match_rate_classrooms: 1 },
      }),
      esperado: "working",
    },
    {
      caso: "dos bases con used=false",
      sourceMode: "dos_bases",
      frame: frameListoConsistencia({
        relationAudit: { used: false, status: "sin_catalogo", issues: [] },
      }),
      esperado: "working",
    },
    {
      caso: "dos bases con used=true/status=ok",
      sourceMode: "dos_bases",
      frame: frameListoConsistencia({
        relationAudit: { used: true, status: "ok", issues: [] },
      }),
      esperado: "ready",
    },
    {
      caso: "dos bases con status ok pero issues contradictorios",
      sourceMode: "dos_bases",
      frame: frameListoConsistencia({
        relationAudit: {
          used: true,
          status: "ok",
          issues: [{ code: "catalogo_fuera_de_base" }],
        },
      }),
      esperado: "working",
    },
    ...["revisar", "critico", "pendiente", "desconocido"].map((status) => ({
      caso: `dos bases con used=true/status=${status}`,
      sourceMode: "dos_bases",
      frame: frameListoConsistencia({ relationAudit: { used: true, status, issues: [] } }),
      esperado: "working",
    })),
    {
      caso: "dos bases no coerciona used='false'",
      sourceMode: "dos_bases",
      frame: frameListoConsistencia({
        relationAudit: { used: "false", status: "ok", issues: [] },
      }),
      esperado: "working",
    },
    {
      caso: "source_mode ausente conserva fuente única legacy sin evidencia de catálogo",
      sourceMode: undefined,
      frame: frameListoConsistencia(),
      esperado: "ready",
    },
    {
      caso: "source_mode ausente falla cerrado ante evidencia de catálogo legacy",
      sourceMode: undefined,
      frame: frameListoConsistencia({
        catalogAudit: { used: true, matched_classrooms: 1 },
      }),
      esperado: "working",
    },
  ];

  it.each(guia)("$caso → $esperado", ({ sourceMode, frame, esperado }) => {
    expect(evaluarConsistenciaMarco(sourceMode, frame)).toBe(esperado);
  });
});
