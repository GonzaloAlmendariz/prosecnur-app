import {
  type CalcMuestraComponente,
  type CalcMuestraNivelRespaldo,
  type CalcMuestraOrigenTamano,
  type CalcMuestraParametros,
  type CalcMuestraTecnica,
  type CalcMuestraWorkspaceFrameMode,
} from "../../api/client";

export type ActiveDesk = CalcMuestraWorkspaceFrameMode;
export type GuideStatus = "ready" | "working" | "pending";
export type ComponentePatch = Omit<Partial<CalcMuestraComponente>, "marco" | "parametros" | "meta"> & {
  marco?: Partial<CalcMuestraComponente["marco"]>;
  parametros?: Partial<CalcMuestraComponente["parametros"]>;
  meta?: Partial<CalcMuestraComponente["meta"]>;
};

export function guideStatus(done: boolean, enabled = true): GuideStatus {
  if (done) return "ready";
  return enabled ? "working" : "pending";
}

export const DEFAULT_PARAMS: CalcMuestraParametros = {
  z: 1.96,
  p: 0.5,
  e: 0.05,
  deff: 1,
  tau: 0.7,
  oversample_pct: 0.1,
  tasa_contacto: 0.5,
  tasa_elegibilidad: 0.9,
  tasa_respuesta: 0.7,
  cobertura_objetivo: 0.6,
  promedio_conglomerado: 25,
  n_minimo_estrato: 30,
  tope_operativo: 150,
};

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function fmtInt(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("es-PE");
}

export function fmtPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  // Bordes honestos: un valor mayor que 0% nunca se muestra como "0.0%" y uno
  // menor que 100% nunca se redondea hasta "100.0%" (p. ej. 5,262 de 5,263).
  if (pct > 0 && pct < 0.05) return "<0.1%";
  if (pct < 100 && pct >= 99.95) return "99.9%";
  return `${pct.toFixed(1)}%`;
}

/** Decimales con convención es-PE (miles con coma, decimales con punto): 4,659.5 · 12.48. */
export function fmtDec(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("es-PE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Razones tipo "×2.3" con la misma convención decimal que fmtDec. */
export function fmtRatio(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `×${fmtDec(value, digits)}`;
}

export function roundUpTo(value: number | null | undefined, multiple: number) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (!Number.isFinite(multiple) || multiple <= 1) return Math.ceil(value);
  return Math.ceil(value / multiple) * multiple;
}

export function fmtSignedInt(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("es-PE")}`;
}

export function naturalezaPara(tecnica: CalcMuestraTecnica) {
  if (tecnica.startsWith("prob_") || tecnica === "sistematico" || tecnica === "medicion_recurrente") return "prob";
  if (tecnica === "intencion_censal" || tecnica === "barrido" || tecnica === "listado_externo_meta_fija") return "operativo";
  return "no_prob";
}

export function origenPara(tecnica: CalcMuestraTecnica): CalcMuestraOrigenTamano {
  if (tecnica === "intencion_censal" || tecnica === "barrido") return "cobertura_esperada";
  if (tecnica === "no_prob_cuotas" || tecnica === "no_prob_conveniencia") return "matriz_perfiles_cualitativa";
  if (tecnica === "listado_externo_meta_fija") return "meta_contractual";
  return "formula";
}

export function respaldoPara(tecnica: CalcMuestraTecnica): CalcMuestraNivelRespaldo {
  if (tecnica.startsWith("prob_") || tecnica === "sistematico") return "representatividad_estadistica";
  if (tecnica === "intencion_censal" || tecnica === "barrido") return "representatividad_operacional";
  if (tecnica === "no_prob_cuotas") return "representatividad_teorica_controlada";
  return "evidencia_descriptiva";
}

export function defaultComponente(overrides: ComponentePatch = {}): CalcMuestraComponente {
  const tecnica = overrides.tecnica ?? "prob_aleatorio_simple";
  return {
    id: overrides.id ?? uid("cmp"),
    actor: overrides.actor ?? "Población objetivo",
    actor_id: overrides.actor_id ?? "poblacion_objetivo",
    actor_categoria: overrides.actor_categoria ?? "otros",
    canal_recojo: overrides.canal_recojo ?? "presencial",
    tecnica,
    naturaleza: overrides.naturaleza ?? naturalezaPara(tecnica),
    origen_tamano: overrides.origen_tamano ?? origenPara(tecnica),
    nivel_respaldo: overrides.nivel_respaldo ?? respaldoPara(tecnica),
    marco: {
      universo_bruto: 0,
      marco_validado: 0,
      marco_contactable: 0,
      estado: "no_definido",
      notas: "",
      estratos: [],
      matriz_operativa: [],
      ...(overrides.marco ?? {}),
    },
    parametros: { ...DEFAULT_PARAMS, ...(overrides.parametros ?? {}) },
    meta: {
      tipo: "objetivo",
      valor: 0,
      variable_control: "",
      sub_cuotas: {},
      ...(overrides.meta ?? {}),
    },
    resultado: overrides.resultado ?? null,
    inferencia_acreditacion: overrides.inferencia_acreditacion,
  };
}

export function setTecnica(comp: CalcMuestraComponente, tecnica: CalcMuestraTecnica): CalcMuestraComponente {
  return {
    ...comp,
    tecnica,
    naturaleza: naturalezaPara(tecnica),
    origen_tamano: origenPara(tecnica),
    nivel_respaldo: respaldoPara(tecnica),
    resultado: null,
  };
}

export function rowsFrom<T = Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const arrayKeys = Object.keys(record).filter((key) => Array.isArray(record[key]));
  if (!arrayKeys.length) return [];
  const rowCount = Math.max(...arrayKeys.map((key) => (record[key] as unknown[]).length));
  if (!Number.isFinite(rowCount) || rowCount <= 0) return [];
  return Array.from({ length: rowCount }, (_, index) => {
    const row: Record<string, unknown> = {};
    arrayKeys.forEach((key) => {
      row[key] = (record[key] as unknown[])[index];
    });
    return row as T;
  });
}
