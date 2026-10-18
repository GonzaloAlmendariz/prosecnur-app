/**
 * La fuente de la tasa de efectividad: la que el estudio DECLARA en
 * `aulas_config.efectividad` y la que el marco CONSTRUIDO usó (cada fila del
 * marco la anota en `efectividad_fuente` / `efectividad_tau`,
 * calc_muestra_aulas_efectividad.R).
 *
 * Existe porque un estudio sin histórico propio (UNSA 2026) dimensionaba en
 * silencio con la calibración embebida, medida en otro estudio, y no había
 * forma de declarar desde la pantalla una tasa única. Las dos lecturas viven
 * juntas para que la tarjeta que declara y el aviso de «marco desactualizado»
 * no puedan discrepar sobre qué cuenta como cambio.
 */
import type { CalcMuestraEfectividadConfig, CalcMuestraTauReseteado } from "../../../../api/calcMuestra";

export type TipoFuenteEfectividad = "historico" | "calibracion_embebida" | "tau_global";

export type FuenteEfectividadLeida = {
  tipo: TipoFuenteEfectividad;
  /** Sólo con `tau_global`. */
  tau: number | null;
  periodo: string;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Lo que el estudio declara. Sin declaración válida rige la calibración embebida. */
export function fuenteDeclarada(efectividad: unknown): FuenteEfectividadLeida {
  const ef = efectividad && typeof efectividad === "object" ? (efectividad as Record<string, unknown>) : {};
  const fuente = String(ef.fuente ?? "").trim();
  const periodo = String(ef.periodo ?? "").trim();
  if (fuente === "tau_global") {
    const tau = num(ef.tau);
    // Mismo rango que acepta el normalizador de R: fuera de él, R lo descarta
    // y rige la embebida, así que aquí se lee igual.
    if (tau != null && tau > 0 && tau <= 1) return { tipo: "tau_global", tau, periodo };
    return { tipo: "calibracion_embebida", tau: null, periodo: "" };
  }
  if (fuente === "historico") return { tipo: "historico", tau: null, periodo };
  return { tipo: "calibracion_embebida", tau: null, periodo: "" };
}

/**
 * Lo que usó el marco construido. `null` si las filas no traen la anotación
 * (marco anterior a ella): no hay con qué comparar y no se acusa nada.
 */
export function fuenteConstruida(aulaFrame: unknown): FuenteEfectividadLeida | null {
  if (!Array.isArray(aulaFrame)) return null;
  const fila = aulaFrame.find(
    (f) => f && typeof f === "object" && String((f as Record<string, unknown>).efectividad_fuente ?? "").trim(),
  ) as Record<string, unknown> | undefined;
  if (!fila) return null;
  const tipoRaw = String(fila.efectividad_fuente).trim();
  const tipo: TipoFuenteEfectividad =
    tipoRaw === "historico" || tipoRaw === "tau_global" ? tipoRaw : "calibracion_embebida";
  return {
    tipo,
    tau: tipo === "tau_global" ? num(fila.efectividad_tau) : null,
    periodo: String(fila.efectividad_periodo ?? "").trim(),
  };
}

/** ¿El marco se construyó con otra fuente que la declarada? R anota la tasa con 3 decimales. */
export function efectividadDesactualizada(efectividadConfig: unknown, aulaFrame: unknown): boolean {
  const construida = fuenteConstruida(aulaFrame);
  if (!construida) return false;
  const declarada = fuenteDeclarada(efectividadConfig);
  if (declarada.tipo !== construida.tipo) return true;
  if (declarada.tipo === "tau_global") {
    if (declarada.tau == null || construida.tau == null) return true;
    return Math.abs(Math.round(declarada.tau * 1000) - Math.round(construida.tau * 1000)) > 0;
  }
  return false;
}

/** La declaración que escribe la tarjeta: una sola tasa para todas las facultades. */
export function declararTauGlobal(tau: number, periodo: string): CalcMuestraEfectividadConfig {
  return { fuente: "tau_global", tau, periodo };
}

/**
 * `resultado.tau_reseteados` leído a la defensiva: facultades que volvieron al
 * τ de respaldo porque el marco dejó de publicar su tasa propia.
 */
export function tauReseteados(raw: unknown): CalcMuestraTauReseteado[] {
  if (!Array.isArray(raw)) return [];
  const out: CalcMuestraTauReseteado[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const f = r as Record<string, unknown>;
    const facultad = String(f.facultad ?? "").trim();
    const anterior = num(f.tau_anterior);
    const vigente = num(f.tau_vigente);
    if (!facultad || anterior == null || vigente == null) continue;
    out.push({ facultad, tau_anterior: anterior, tau_vigente: vigente });
  }
  return out;
}

/** Estratos con la tasa fijada a mano: el motor la conserva aun con `tau_global`. */
export function contarTauManuales(estratos: unknown): number {
  if (!Array.isArray(estratos)) return 0;
  return estratos.filter((e) => {
    if (!e || typeof e !== "object") return false;
    const r = e as Record<string, unknown>;
    return r.tau_origen === "manual" && (num(r.tau) ?? 0) > 0;
  }).length;
}
