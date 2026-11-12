/**
 * Datos de los escenarios de la caracterización de Validación. Ver arnes.tsx.
 *
 * Son respuestas del backend escritas a mano con la forma que el motor publica
 * (`api/R/router_validacion.R`). No imitan un estudio real: cubren los estados
 * que la vista distingue (sin plan, plan sin auditoría, con hallazgos de las
 * tres clases, decisiones en borrador y listas, base promovida, dos bases y
 * madre con hija de un grupo repetido).
 */
import type { SessionState } from "../../../api/core";
import type { EstudioBase, EstudioPayload } from "../../../api/estudio";
import type {
  ExploradorVariablesList,
  InstrumentoEstado,
  InstrumentoVariablesExcluidas,
  LimpiezaDecision,
  LimpiezaQueueItem,
  LimpiezaSummary,
  ReglaCustom,
  ReglaSemilla,
  ViewDescriptor,
} from "../types";
import { estado, Fallo, type Ruta } from "./arnes";

// ── Estudio y sesión ─────────────────────────────────────────────────────────

export function base(nombre: string, cambios: Partial<EstudioBase> = {}): EstudioBase {
  return {
    nombre,
    xlsform_file_id: `xls-${nombre}`,
    xlsform_file_name: `${nombre}.xlsx`,
    data_file_id: `dat-${nombre}`,
    data_file_name: `${nombre}-respuestas.xlsx`,
    data_ext: "xlsx",
    n_filas: 120,
    n_columnas: 34,
    added_at: "2026-01-02T00:00:00Z",
    source_kind: "manual",
    ...cambios,
  };
}

export function estudio(bases: EstudioBase[], cambios: Partial<EstudioPayload> = {}): EstudioPayload {
  return {
    nombre: "Estudio de prueba",
    processing_mode: bases.length > 1 ? "multibase" : "single",
    topology_declared: "separate",
    active_base: bases[0]?.nombre ?? null,
    n_bases: bases.length,
    bases: Object.fromEntries(bases.map((b) => [b.nombre, b])),
    max_bases: 12,
    ...cambios,
  };
}

export const SIN_INSUMOS = estado({});

export const UNA_BASE = {
  estado: estado({
    xlsform: true,
    data: true,
    instrumento_parsed: true,
    data_previewed: true,
    has_estudio: true,
    n_bases: 1,
    bases_nombres: ["default"],
    active_base: "default",
  }),
  estudio: estudio([base("default")]),
};

export const DOS_BASES = {
  estado: estado({
    xlsform: true,
    data: true,
    instrumento_parsed: true,
    data_previewed: true,
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "separate",
    n_bases: 2,
    bases_nombres: ["docentes", "estudiantes"],
    active_base: "estudiantes",
  }),
  estudio: estudio([base("docentes"), base("estudiantes", { n_filas: 480 })], { active_base: "estudiantes" }),
};

export const MADRE_E_HIJA = {
  estado: estado({
    xlsform: true,
    data: true,
    instrumento_parsed: true,
    data_previewed: true,
    has_estudio: true,
    estudio_processing_mode: "multibase",
    estudio_topology_declared: "separate",
    n_bases: 2,
    bases_nombres: ["hogares", "miembros"],
    active_base: "miembros",
  }),
  estudio: estudio(
    [
      base("hogares"),
      base("miembros", { source_kind: "kobo_repeat", parent_base: "hogares", repeat_group: "miembros", n_filas: 900 }),
    ],
    { active_base: "miembros" },
  ),
};

export type Contexto = { estado: SessionState; estudio: EstudioPayload };

// ── Gráficos ─────────────────────────────────────────────────────────────────

export function vista(kind: ViewDescriptor["kind"], title: string, meta: ViewDescriptor["meta"] = {}): ViewDescriptor {
  return {
    version: 1,
    kind,
    title,
    meta,
    plotly: { data: [{ type: kind === "heatmap_semaforo" ? "heatmap" : "bar", x: [1, 2], y: ["a", "b"] }], layout: {} },
  };
}

// ── Formulario: estado, plan y auditoría ─────────────────────────────────────

export function estadoInstrumento(plan: boolean, auditoria: boolean, cambios: Partial<InstrumentoEstado> = {}): InstrumentoEstado {
  return {
    ok: true,
    base_nombre: null,
    plan_construido: plan,
    auditoria_corrida: auditoria,
    n_reglas: plan ? 6 : 0,
    variables_excluidas: [],
    n_variables_excluidas: 0,
    views: [],
    ...cambios,
  };
}

export const VARIABLES_EXCLUIDAS: InstrumentoVariablesExcluidas = {
  ok: true,
  base_nombre: null,
  variables: ["obs_campo"],
  opciones: [
    { variable: "edad", label: "Edad en años cumplidos", n_reglas: 3, n_reglas_con_casos: 2, n_inconsistencias: 14 },
    { variable: "p21", label: "Situación laboral", n_reglas: 2, n_reglas_con_casos: 1, n_inconsistencias: 1250 },
    { variable: "obs_campo", label: "", n_reglas: 1, n_reglas_con_casos: 0, n_inconsistencias: 0 },
  ],
};

/** Filas del resumen de la auditoría: una por grupo que la vista distingue. */
export const RESUMEN_TABLA: Array<Record<string, unknown>> = [
  {
    id_regla: "R_REQ_EDAD", nombre_regla: "Edad obligatoria", tipo_observacion: "integer", seccion: "Datos generales",
    porcentaje: 4.2, n_inconsistencias: 5, variable_1: "edad", variable_1_etiqueta: "Edad en años cumplidos",
    estado_dinamico: "correcta", tipo_regla: "required", categoria_ux: "Completitud",
    presentation: { nombre_humano: "La edad no puede quedar vacía", objetivo: "Completitud de la edad" },
    variable_roles: { target: "edad" },
  },
  {
    id_regla: "R_RANGO_EDAD", nombre_regla: "Edad obligatoria", tipo_observacion: "integer", seccion: "Datos generales",
    porcentaje: 7.5, n_inconsistencias: 9, variable_1: "edad", variable_1_etiqueta: "Edad en años cumplidos",
    estado_dinamico: "correcta", tipo_regla: "range", categoria_ux: "Rango",
  },
  {
    id_regla: "R_SALTO_P21", nombre_regla: "Salto a P21", tipo_observacion: "select_one", seccion: "Trabajo",
    porcentaje: 0, n_inconsistencias: 0, variable_1: "p21", variable_2: "p4", estado_dinamico: "correcta",
    tipo_regla: "skip", categoria_ux: "Saltos",
  },
  {
    id_regla: "R_DUMMY_Q7", nombre_regla: "Opciones de q7", tipo_observacion: "select_multiple", seccion: "Servicios",
    porcentaje: null, n_inconsistencias: null, variable_1: "q7", estado_dinamico: "no_aplicable",
    issue_code: "missing_columns", detalle: "Columnas ausentes: q7_1, q7_2 | revisar exportación",
  },
  {
    id_regla: "R_ODK_RAW", nombre_regla: "Constraint compuesto", tipo_observacion: "text", seccion: "Servicios",
    porcentaje: null, n_inconsistencias: null, variable_1: "q9", estado_dinamico: "no_evaluada", issue_code: "odk_raw",
  },
  {
    id_regla: "R_DESAL_CONSENT", nombre_regla: "Consentimiento", tipo_observacion: "select_one", seccion: "Inicio",
    porcentaje: null, n_inconsistencias: null, variable_1: "consent", estado_dinamico: "desalineada",
    detalle: "consent='OK' no existe en los datos",
  },
  {
    id_regla: "R_PULL_SEDE", nombre_regla: "Sede del listado", tipo_observacion: "calculate", seccion: "Inicio",
    porcentaje: null, n_inconsistencias: null, variable_1: "sede_ppl", estado_dinamico: "no_evaluada",
    issue_code: "requires_external_dataset", categoria_ux: "roster_externo",
  },
];

export const RESULTADO = {
  ok: true,
  base_nombre: null,
  kpis: [vista("kpi_card", "Reglas evaluadas", { eyebrow: "Plan" }), vista("kpi_card", "Casos con hallazgos")],
  top_reglas: vista("bar_h", "Reglas con más casos"),
  heatmap: vista("heatmap_semaforo", "Hallazgos por sección"),
  resumen_tabla: RESUMEN_TABLA,
};

export function drill(id: string) {
  return {
    ok: true,
    regla: {
      id,
      nombre: "Edad obligatoria",
      objetivo: "Completitud de la edad",
      tipo_observacion: "integer",
      seccion: "Datos generales",
      categoria: "Completitud",
      tabla: null,
      variables: ["edad"],
      variable_roles: { target: "edad", labels: { edad: "Edad en años cumplidos" } },
      procesamiento: null,
      activa: true,
      n_inconsistencias: 2,
      porcentaje: 1.7,
    },
    uuid_col: "_uuid",
    case_ids: ["c-001", "c-002"],
    casos: [
      { _uuid: "c-001", edad: "", sexo: "1", distrito: "Cercado" },
      { _uuid: "c-002", edad: "", sexo: "2", distrito: "Yanahuara" },
    ],
  };
}

export const RUTA_DRILL: Ruta = [
  "POST",
  "/api/validacion/v2/instrumento/regla",
  (_url: string, cuerpo: string) => drill(String((JSON.parse(cuerpo || "{}") as { id_regla?: string }).id_regla ?? "")),
];

export function rutasInstrumento(plan: boolean, auditoria: boolean, cambios: Partial<InstrumentoEstado> = {}): Ruta[] {
  return [
    rutaCatalogo(catalogoDeReglas({ plan, auditoria })),
    ["GET", "/api/validacion/v2/instrumento/estado", estadoInstrumento(plan, auditoria, cambios)],
    ["GET", "/api/validacion/v2/instrumento/variables-excluidas", VARIABLES_EXCLUIDAS],
    ["GET", "/api/validacion/v2/instrumento/resultado", RESULTADO],
    ["GET", "/api/validacion/v2/roles/sugerencias", { ok: true, identidad: { llaves: [], agentes: [] }, periodo: null, caso_valido: [] }],
    RUTA_DRILL,
  ];
}

// ── Catálogo de reglas (M3) ──────────────────────────────────────────────────

type ReglaDelCatalogoCrudo = Record<string, unknown>;

function reglaDelFormulario(
  id: string,
  familia: string,
  pregunta: [codigo: string, etiqueta: string, tipo: string],
  cambios: ReglaDelCatalogoCrudo = {},
): ReglaDelCatalogoCrudo {
  return {
    id, id_motor: id, origen: id.startsWith("OP_") ? "operativo" : "formulario", familia,
    nombre: `Regla de "${pregunta[1]}"`,
    frase: [{ pregunta: pregunta[0], etiqueta: pregunta[1], tipo: pregunta[2] }, { texto: " es obligatoria." }],
    clase: "inconsistencia", hallazgo_kind: "inconsistencia_xlsform", tratamiento_previsto: { accion: null, alcance: null },
    activa: true, motivo_desactivada: null, se_puede_desactivar: true, variable_revisada: pregunta[0], variables: [pregunta[0]],
    tabla: "principal", expresion_formulario: null, direccion: null, pareja: null,
    estado_evaluacion: "evaluada", causa_codigo: null, causa: null, ultima_auditoria: null, limites: null,
    ...cambios,
  };
}

function auditada(n: number, base: number, definicion = "que respondieron la pregunta"): ReglaDelCatalogoCrudo {
  return { ultima_auditoria: { n_casos: n, n_base: base, base_definicion: definicion, porcentaje: base ? n / base : null, nivel: "caso", n_decididos: 0 } };
}

const FAMILIAS_DEL_CATALOGO: Record<string, string> = {
  obligatoria: "Obligatorias", salto: "Saltos", restriccion: "Restricciones", calculo: "Valores calculados",
  rango_num: "Valor fuera de rango", coherencia_2v: "Dos respuestas que deben cuadrar",
};

/**
 * El catálogo de reglas de los escenarios: con plan, las reglas del resumen de
 * la auditoría (`RESUMEN_TABLA`) con su familia y su estado; con auditoría, sus
 * casos; y las propias que se pasan.
 */
export function catalogoDeReglas({ plan, auditoria, propias = [], formulario = plan }: {
  plan: boolean;
  auditoria: boolean;
  propias?: ReglaCustom[];
  /** Con `false`, el plan está leído pero los escenarios solo miran las propias. */
  formulario?: boolean;
}) {
  const delFormulario = formulario
    ? [
        reglaDelFormulario("R_REQ_EDAD", "obligatoria", ["edad", "Edad en años cumplidos", "numerica"], auditoria ? auditada(5, 120, "casos de la base") : {}),
        reglaDelFormulario("R_RANGO_EDAD", "restriccion", ["edad", "Edad en años cumplidos", "numerica"], {
          nombre: "\"Edad en años cumplidos\" entre 16 y 99", expresion_formulario: ". >= 16 and . <= 99",
          ...(auditoria ? auditada(9, 115) : {}),
        }),
        reglaDelFormulario("R_SALTO_P21", "salto", ["p21", "Situación laboral", "unica"], {
          nombre: "Salto de \"Situación laboral\": vacía cuando le correspondía", direccion: "debe", pareja: null,
          expresion_formulario: "${p4} = '1'", ...(auditoria ? auditada(0, 64, "a quienes les correspondía responder") : {}),
        }),
        reglaDelFormulario("R_ODK_RAW", "restriccion", ["q9", "Servicio", "texto"], {
          estado_evaluacion: "sin_evaluar", causa_codigo: "expresion_no_leida", causa: "Expresión que no se pudo leer",
          expresion_formulario: "regex(., '^[0-9]{8}$')",
        }),
        reglaDelFormulario("R_PULL_SEDE", "calculo", ["sede_ppl", "Sede", "texto"], {
          estado_evaluacion: "sin_evaluar", causa_codigo: "listado_externo", causa: "Depende de un listado externo",
        }),
      ]
    : [];
  const deLasPropias = propias.map((r): ReglaDelCatalogoCrudo => ({
    ...reglaDelFormulario(r.id, r.tipo, [r.variables[0] ?? "edad", "Edad en años cumplidos", "numerica"]),
    id_motor: r.id, origen: "propia", nombre: r.nombre, activa: r.activa,
    clase: r.hallazgo_kind === "caso_validar" ? "caso_a_revisar" : "inconsistencia",
    hallazgo_kind: r.hallazgo_kind ?? "caso_validar",
    tratamiento_previsto: { accion: r.planned_action_type ?? null, alcance: r.recommended_scope ?? null },
    frase: [{ texto: "Se marca cuando " }, { pregunta: r.variables[0] ?? "edad", etiqueta: "Edad en años cumplidos", tipo: "numerica" }, { texto: " está fuera de lo esperado." }],
  }));
  const reglas: ReglaDelCatalogoCrudo[] = [...delFormulario, ...deLasPropias];
  const claves = [...new Set(reglas.map((r) => `${String(r.origen)}|${String(r.familia)}`))];
  return {
    ok: true, base_nombre: null, variable: null, plan_construido: plan,
    auditada_en: auditoria ? "2026-11-08T15:00:00Z" : null,
    n_total: reglas.length, n_activas: reglas.filter((r) => r.activa).length,
    n_sin_evaluar: reglas.filter((r) => r.estado_evaluacion === "sin_evaluar").length,
    por_origen: {
      formulario: reglas.filter((r) => r.origen === "formulario").length,
      operativo: reglas.filter((r) => r.origen === "operativo").length,
      propia: reglas.filter((r) => r.origen === "propia").length,
    },
    familias: claves.map((clave) => {
      const [origen, familia] = clave.split("|");
      const de = reglas.filter((r) => r.origen === origen && r.familia === familia);
      return {
        origen, familia, nombre: FAMILIAS_DEL_CATALOGO[familia] ?? familia, n: de.length,
        n_activas: de.filter((r) => r.activa).length, n_sin_evaluar: de.filter((r) => r.estado_evaluacion === "sin_evaluar").length,
      };
    }),
    reglas,
    avisos: [],
  };
}

export function rutaCatalogo(catalogo: ReturnType<typeof catalogoDeReglas>): Ruta {
  return ["GET", /^\/api\/validacion\/v2\/reglas\/catalogo/, catalogo];
}

// ── Explorar ─────────────────────────────────────────────────────────────────

export const INVENTARIO: ExploradorVariablesList = {
  ok: true,
  base_nombre: null,
  n_variables: 5,
  secciones: [
    {
      nombre: "Datos generales",
      variables: [
        { name: "edad", label: "Edad en años cumplidos", tipo: "num", n_validos: 115, n_nulos: 5 },
        { name: "sexo", label: "Sexo", tipo: "so", n_validos: 120, n_nulos: 0 },
        { name: "fecha", label: "Fecha de la entrevista", tipo: "fecha", n_validos: 120, n_nulos: 0 },
      ],
    },
    {
      nombre: "Servicios",
      variables: [
        { name: "q7", label: "Servicios recibidos", tipo: "sm", n_validos: 98, n_nulos: 22 },
        { name: "obs", label: "Observaciones", tipo: "texto", n_validos: 40, n_nulos: 80 },
      ],
    },
  ],
};

export function univariado(variable: string) {
  return {
    ok: true,
    base_nombre: null,
    var: variable,
    tipo: "so",
    label: "Sexo",
    kpis: [],
    chart: vista("bar_h", "Distribución"),
    n_tras_filtro: 120,
    n_total: 120,
    filtros_aplicados: 0,
    dist: {
      tipo: "so",
      ordinal: false,
      base_n: 120,
      filas: [
        { codigo: "1", etiqueta: "Hombre", n: 52, pct: 43.3 },
        { codigo: "2", etiqueta: "Mujer", n: 68, pct: 56.7 },
      ],
    },
  };
}

export const RUTAS_EXPLORAR: Ruta[] = [
  ["GET", /^\/api\/validacion\/v2\/explorar\/variables/, INVENTARIO],
  ["POST", "/api/validacion/v2/explorar/univariado", (_url: string, cuerpo: string) =>
    univariado(String((JSON.parse(cuerpo || "{}") as { var?: string }).var ?? ""))],
  ["GET", /^\/api\/validacion\/v2\/explorar\/ficha/, new Fallo("E_NOT_FOUND", "Sin ficha", 404)],
  ["GET", /^\/api\/validacion\/v2\/explorar\/valores/, {
    ok: true, var: "sexo", tipo: "so", n_validos: 120,
    opciones: [{ code: "1", label: "Hombre", n: 52 }, { code: "2", label: "Mujer", n: 68 }],
  }],
];

// ── Reglas propias ───────────────────────────────────────────────────────────

export function reglaPropia(id: string, cambios: Partial<ReglaCustom> = {}): ReglaCustom {
  return {
    id,
    created_at: "2026-03-01T10:00:00Z",
    activa: true,
    nombre: "Edad entre 16 y 25",
    tipo: "rango_num",
    variables: ["edad"],
    params: { min: "16", max: "25" },
    mensaje: "Edad fuera del rango del estudio",
    severidad: "error",
    hallazgo_kind: "inconsistencia_usuario",
    planned_action_type: "ignore_rule",
    recommended_scope: "single",
    gate_conditions: [],
    ...cambios,
  };
}

export const REGLAS_PROPIAS: ReglaCustom[] = [
  reglaPropia("RC_001"),
  reglaPropia("RC_002", {
    nombre: "Sexo y servicio",
    tipo: "coherencia_2v",
    variables: ["sexo", "q7"],
    params: { op_x: "==", valor_x: "1", op_y: "!=", valor_y: "3" },
    hallazgo_kind: "caso_validar",
    severidad: "advertencia",
    activa: false,
    origen: "sembrado",
    gate_conditions: [{ variable: "edad", op: ">=", value: "18" }],
  }),
];

export const SEMILLAS: ReglaSemilla[] = [
  {
    activa: true,
    nombre: "Duplicados por documento",
    tipo: "duplicados",
    variables: ["dni"],
    params: {},
    mensaje: "Documento repetido",
    severidad: "advertencia",
    hallazgo_kind: "caso_validar",
    semilla: { origen: "procedencia", porque: "La columna dni identifica a cada persona y tiene 3 repetidos.", n_casos_afectados: 3 },
  },
];

export function rutasReglasPropias(reglas: ReglaCustom[], semillas: ReglaSemilla[] = SEMILLAS): Ruta[] {
  return [
    rutaCatalogo(catalogoDeReglas({ plan: true, auditoria: false, propias: reglas, formulario: false })),
    ["GET", "/api/validacion/v2/reglas_custom", { ok: true, base_nombre: null, reglas }],
    ["GET", "/api/validacion/v2/reglas_custom/semillas", { ok: true, semillas }],
    ["POST", "/api/validacion/v2/reglas_custom", (_url: string, cuerpo: string) => ({
      ok: true, regla: { ...(JSON.parse(cuerpo || "{}") as object), id: "RC_NUEVA", created_at: "2026-03-02T10:00:00Z" },
    })],
    ["PUT", /^\/api\/validacion\/v2\/reglas_custom\/[^/]+$/, (_url: string, cuerpo: string) => ({
      ok: true, regla: JSON.parse(cuerpo || "{}") as object,
    })],
    ["DELETE", /^\/api\/validacion\/v2\/reglas_custom\/[^/]+$/, { ok: true }],
    ["POST", "/api/validacion/v2/reglas_custom/ejecutar", { ok: true, job_id: "job-reglas", n_custom: 1 }],
    ...RUTAS_EXPLORAR,
  ];
}

// ── Limpieza ─────────────────────────────────────────────────────────────────

export function itemCola(id: string, cambios: Partial<LimpiezaQueueItem> = {}): LimpiezaQueueItem {
  return {
    source_type: "instrument_rule",
    source_id: id,
    nombre_regla: "Edad obligatoria",
    seccion: "Datos generales",
    tipo_regla: "required",
    categoria_ux: "Completitud",
    fuente: "instrumento",
    tipo_variable: "integer",
    hallazgo_kind: "inconsistencia_xlsform",
    origen: "instrumento",
    categoria: "Completitud",
    tipo_observacion: "integer",
    severidad: "error",
    variables: ["edad"],
    n_casos: 2,
    porcentaje: 1.7,
    decision_count: 0,
    current_action: null,
    pending: true,
    impact_expected: "Sin cambios hasta decidir",
    ...cambios,
  };
}

export const COLA_TRES_CLASES: LimpiezaQueueItem[] = [
  itemCola("R_REQ_EDAD"),
  itemCola("RC_001", {
    source_type: "custom_rule",
    nombre_regla: "Edad entre 16 y 25",
    tipo_regla: "range",
    categoria_ux: "Rango",
    fuente: "custom",
    hallazgo_kind: "inconsistencia_usuario",
    n_casos: 9,
    porcentaje: 7.5,
    planned_action_type: "exclude_cases",
    recommended_scope: "selected",
  }),
  itemCola("RC_002", {
    source_type: "custom_rule",
    nombre_regla: "Sexo y servicio",
    tipo_regla: "coherence",
    categoria_ux: "Cruce",
    fuente: "custom",
    hallazgo_kind: "caso_validar",
    severidad: "advertencia",
    variables: ["sexo", "q7"],
    tipo_variable: "select_multiple",
    n_casos: 4,
    porcentaje: 3.3,
    decision_count: 1,
    current_action: "Documentar sin cambios",
    pending: false,
    n_casos_cubiertos: 4,
    n_casos_pendientes: 0,
  }),
];

export function decision(id: string, cambios: Partial<LimpiezaDecision> = {}): LimpiezaDecision {
  return {
    id,
    source_type: "custom_rule",
    source_id: "RC_002",
    scope: "rule",
    target_case_ids: [],
    target_variable: null,
    action_type: "ignore_rule",
    action_params: {},
    rationale: "Los casos se confirmaron con la supervisora de campo",
    status: "ready",
    created_at: "2026-03-03T09:00:00Z",
    updated_at: "2026-03-03T09:30:00Z",
    ...cambios,
  };
}

export const DECISIONES: LimpiezaDecision[] = [
  decision("D_001"),
  decision("D_002", {
    source_type: "instrument_rule",
    source_id: "R_REQ_EDAD",
    scope: "case_subset",
    target_case_ids: ["c-001"],
    target_variable: "edad",
    action_type: "set_value",
    action_params: { value: "18" },
    rationale: "Edad confirmada por teléfono",
    status: "draft",
  }),
];

const RESUMEN_DECISIONES = {
  total_reglas_con_casos: 3,
  total_reglas_automaticas: 1,
  total_reglas_custom: 2,
  total_casos_afectados: 15,
  total_decisiones: 2,
  decisiones_listas: 1,
  pendientes: 2,
  total_casos_excluidos: 0,
  total_celdas_corregidas: 1,
  total_reemplazos: 0,
  total_imputaciones: 0,
  ready_to_finalize: false,
};

export function limpieza(opciones: {
  auditoria: boolean;
  cola?: LimpiezaQueueItem[];
  decisiones?: LimpiezaDecision[];
  listaParaCerrar?: boolean;
  promovida?: boolean;
  preservadas?: boolean;
}): LimpiezaSummary {
  const cola = opciones.cola ?? [];
  return {
    ok: true,
    base_nombre: null,
    progreso: { plan_construido: true, auditoria_corrida: opciones.auditoria, n_reglas_custom: 2 },
    decisiones_preservadas: opciones.preservadas
      ? { n: 3, n_casos: 7, n_sin_evaluar: 0, n_sin_regla: 1, n_sin_variable: 0, n_sin_instrumento: 0 }
      : undefined,
    summary: { ...RESUMEN_DECISIONES, ready_to_finalize: !!opciones.listaParaCerrar },
    kpis: [],
    top_reglas: null,
    top_variables: null,
    decision_queue: cola,
    decision_draft: opciones.decisiones ?? [],
    // Corrección 15-M del motor: las cifras de la última auditoría con su grano.
    // Se derivan de la cola del escenario; los encuestados no pueden pasar de
    // los casos ni de los hallazgos.
    cifras_hallazgos: opciones.auditoria
      ? {
          n_hallazgos: cola.reduce((t, item) => t + item.n_casos, 0),
          n_reglas_evaluadas: 9,
          n_reglas_con_casos: cola.filter((item) => item.n_casos > 0).length,
          n_casos_evaluados: 120,
          n_encuestados_con_hallazgos: Math.min(120, cola.reduce((t, item) => t + item.n_casos, 0)),
          n_registros_sin_encuestado: 0,
          por_tabla: [],
        }
      : null,
    identificacion_casos: opciones.auditoria
      ? { metodo: "columna_candidata", columna: "_uuid", n_filas: 120, n_filas_sin_llave: 0 }
      : null,
    module_stats: {
      limpieza: { decisiones: 0, casos_excluidos: 0 },
      reemplazo: { decisiones: 1, celdas: 1 },
      imputacion: { decisiones: 0, celdas: 0 },
      decision_maker: { pendientes: 2, listas: 1 },
    },
    before_after_preview: opciones.decisiones?.length
      ? {
          before: { total_inconsistencias: 15, reglas_con_casos: 3, reglas_total: 9, filas_base: 120 },
          after: { total_inconsistencias: 11, reglas_con_casos: 2, reglas_total: 9, filas_base: 120 },
          impact: { cases_excluded: 0, cells_changed: 1, replacements: 0, normalizations: 0, imputations: 0, rules_resolved: 1 },
          residual_final: [],
          decisions_ready: 1,
        }
      : null,
    artifacts: opciones.promovida
      ? {
          finalized_at: "2026-03-04T12:00:00Z",
          promocion: {
            enabled: true,
            source_data_file_id: "dat-default",
            effective_data_file_id: "dat-limpia",
            applied_at: "2026-03-04T12:00:00Z",
            n_casos_antes: 120,
            n_casos_despues: 117,
          },
          files: [],
        }
      : {},
    actions: [],
  };
}

/**
 * El efecto previsto de un borrador (M4), armado desde el cuerpo como lo mide
 * el motor sobre 120 casos: excluir saca los casos elegidos (o los 2 de la
 * regla), cambiar valores toca una celda por caso, dejar como está no cambia
 * nada.
 */
export function efectoPrevisto(cuerpo: string) {
  const d = JSON.parse(cuerpo || "{}") as { action_type?: string; target_case_ids?: string[]; target_variable?: string };
  const n = d.target_case_ids?.length || 2;
  const accion = d.action_type ?? "ignore_rule";
  const excluye = accion === "exclude_cases";
  const cambia = !excluye && accion !== "ignore_rule";
  return {
    ok: true, base_nombre: null, accion, variable: d.target_variable ?? null,
    n_filas: excluye || cambia ? n : 0, n_celdas: cambia ? n : 0,
    n_casos_cuentan_antes: 120, n_casos_cuentan_despues: excluye ? 120 - n : 120,
    aplicable: true, motivo_no_aplicable: null, texto_no_aplicable: null, alcance: "caso",
    seguimiento: accion === "ignore_rule" ? "sigue_a_la_regla" : d.target_case_ids?.length ? "casos_elegidos" : "congelada",
    n_casos_al_decidir: accion === "ignore_rule" ? null : n, casos_nuevos: accion === "ignore_rule" ? null : [],
    casos_que_ya_no_marca: [], n_casos_aplicados: n, base_cifras: "casos evaluados en la última auditoría",
  };
}

/** El caso completo (M4) de un caso de los escenarios. */
export function casoCompleto(id: string) {
  return {
    ok: true, base_nombre: null, id_caso: id, tabla: "principal", fila: 1, n_filas_con_el_id: 1, en_otras_tablas: [],
    auditada_en: "2026-11-08T15:00:00Z", instrumento_leido: true, catalogo_leido: true,
    identificacion_casos: { metodo: "columna_candidata", columna: "_uuid", n_filas: 120, n_filas_sin_llave: 0 },
    contexto: { fecha_respuesta: null, recopilador: null, fecha_envio: null, inicio: null, fin: null },
    metadatos: { fecha_respuesta: null, recopilador: null, fecha_envio: null, duracion_min: null, n_respondidas: 2, n_preguntas: 3 },
    codigos_especiales_declarados: [], avisos: [],
    secciones: [{
      seccion: "datos", etiqueta: "Datos generales", n_preguntas: 3, n_respondidas: 2, n_vacias_por_salto: 0,
      variables: [
        { variable: "edad", etiqueta: "Edad en años cumplidos", tipo: "integer", valor: null, origen: "respuesta", estado: "vacia", especial: false, fuera_de_opciones: null },
        { variable: "sexo", etiqueta: "Sexo", tipo: "select_one", valor: "1", valor_etiqueta: "Mujer", origen: "respuesta", estado: "respondida", especial: false, fuera_de_opciones: false },
        { variable: "distrito", etiqueta: "Distrito", tipo: "text", valor: "Cercado", origen: "respuesta", estado: "respondida", especial: false, fuera_de_opciones: null },
      ],
    }],
    hallazgos: [{ id_regla: "R_REQ_EDAD", nombre: "Edad obligatoria", clase: "inconsistencia", hallazgo_kind: "inconsistencia_xlsform", severidad: "error", variables: [{ variable: "edad", etiqueta: "Edad en años cumplidos" }] }],
  };
}

export function rutasLimpieza(resumen: LimpiezaSummary): Ruta[] {
  return [
    ["GET", "/api/validacion/v2/limpieza", resumen],
    // Hallazgos (rebanada V3): el efecto previsto y el caso completo. El catálogo va aparte (`rutasHallazgos`).
    ["POST", "/api/validacion/v2/limpieza/decision/efecto", (_url: string, cuerpo: string) => efectoPrevisto(cuerpo)],
    ["GET", /^\/api\/validacion\/v2\/caso\?/, (url: string) => casoCompleto(new URLSearchParams(url.split("?")[1] ?? "").get("id") ?? "")],
    RUTA_DRILL,
    ["POST", "/api/validacion/v2/limpieza/decision", (_url: string, cuerpo: string) => ({
      ok: true,
      decision: { ...(JSON.parse(cuerpo || "{}") as object), id: "D_NUEVA" },
    })],
    ["DELETE", /^\/api\/validacion\/v2\/limpieza\/decision\/[^/]+$/, { ok: true }],
    ["POST", "/api/validacion/v2/limpieza/revertir-promocion", { ok: true }],
    ["POST", "/api/validacion/v2/limpieza/finalize", { ok: true, job_id: "job-cierre" }],
  ];
}

/** Las de la limpieza más el catálogo de reglas, para la mesa de Hallazgos sola (rebanada V3). */
export function rutasHallazgos(resumen: LimpiezaSummary): Ruta[] {
  return [...rutasLimpieza(resumen), rutaCatalogo(catalogoDeReglas({ plan: true, auditoria: resumen.progreso.auditoria_corrida }))];
}
