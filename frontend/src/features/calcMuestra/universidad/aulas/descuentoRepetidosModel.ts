/**
 * Lógica pura del descuento secuencial de repetidos y de los avisos de estado
 * de la mesa de aulas (Oleada III — contrato calc_muestra_aulas_descuento_v1,
 * confirmado con el backend).
 *
 * Todo es TOLERANTE A AUSENCIA por contrato: si la corrida no trae el bloque
 * `sequential_discount` ni las columnas por aula (`eligible_n_bruto`,
 * `eligible_n_neto`, `aporte_neto`, `ya_cubiertos`) los helpers devuelven
 * null/[] y la UI se comporta exactamente como hoy. Sin recálculos
 * estadísticos: solo agrega/normaliza lo que el motor ya trae.
 */
import type { CalcMuestraAulasSelection, CalcMuestraAulasSelectionDescuento } from "../../../../api/client";
import { fmtInt, rowsFrom } from "../../sharedCore";
import { classroomRowNumber, classroomRowText, rowKeyForCandidates } from "../shared/format";

export const DESCUENTO_SIN_IDS_CODE = "descuento_sin_ids";

export type DiscountMode = "sequential" | "post_hoc";

/** Claves congeladas del contrato, por columna visible. */
const BRUTO_KEYS = ["eligible_n_bruto"];
const NETO_KEYS = ["eligible_n_neto"];
const APORTE_KEYS = ["aporte_neto"];
const CUBIERTOS_KEYS = ["ya_cubiertos"];

/** true si la fila trae señal de descuento (al menos bruto o neto). */
export function rowHasDiscountData(row: Record<string, unknown>): boolean {
  return Boolean(rowKeyForCandidates(row, [...BRUTO_KEYS, ...NETO_KEYS]));
}

/** Gating de las columnas netas en la tabla de titulares. */
export function hasDiscountColumns(rows: Array<Record<string, unknown>>): boolean {
  return rows.some(rowHasDiscountData);
}

/**
 * Celda numérica presence-aware: "—" cuando la fila no trae la clave (una
 * bolsa extra sin columnas de descuento no debe leerse como 0 cubiertos).
 */
export function discountCellText(row: Record<string, unknown>, keys: string[]): string {
  return rowKeyForCandidates(row, keys) ? fmtInt(classroomRowNumber(row, keys)) : "—";
}

export const DISCOUNT_CELL_KEYS = {
  // Fallback a eligible_n SOLO para el bruto: es la misma métrica antes del descuento.
  bruto: [...BRUTO_KEYS, "eligible_n"],
  neto: NETO_KEYS,
  aporte: APORTE_KEYS,
  cubiertos: CUBIERTOS_KEYS,
} as const;

export type DescuentoResumenEstrato = {
  estrato: string;
  aulas: number;
  bruto: number;
  neto: number;
  yaCubiertos: number;
  /** null cuando la fuente no lo trae (el bloque del engine no suma aporte). */
  aporteNeto: number | null;
};

export type DescuentoResumen = {
  estratos: DescuentoResumenEstrato[];
  total: Omit<DescuentoResumenEstrato, "estrato">;
};

function totalizar(estratos: DescuentoResumenEstrato[]): DescuentoResumen["total"] {
  return estratos.reduce<DescuentoResumen["total"]>(
    (sum, item) => ({
      aulas: sum.aulas + item.aulas,
      bruto: sum.bruto + item.bruto,
      neto: sum.neto + item.neto,
      yaCubiertos: sum.yaCubiertos + item.yaCubiertos,
      aporteNeto: item.aporteNeto == null ? sum.aporteNeto : (sum.aporteNeto ?? 0) + item.aporteNeto,
    }),
    { aulas: 0, bruto: 0, neto: 0, yaCubiertos: 0, aporteNeto: null },
  );
}

function ordenarEstratos(estratos: DescuentoResumenEstrato[]): DescuentoResumenEstrato[] {
  return [...estratos].sort((a, b) => a.estrato.localeCompare(b.estrato, "es", { sensitivity: "base", numeric: true }));
}

/**
 * Resumen bruto vs neto por estrato derivado de las filas TITULARES de la
 * selección (agrupa por facultad/estrato y suma lo que el motor trae por
 * fila). Devuelve null cuando ninguna fila trae columnas de descuento, para
 * que la UI no invente un resumen con ceros.
 */
export function buildDescuentoResumen(rows: Array<Record<string, unknown>>): DescuentoResumen | null {
  const conDatos = rows.filter(rowHasDiscountData);
  if (!conDatos.length) return null;
  const porEstrato = new Map<string, DescuentoResumenEstrato>();
  for (const row of conDatos) {
    const estrato = classroomRowText(row, ["faculty", "stratum"]) || "Sin estrato";
    const bruto = classroomRowNumber(row, [...DISCOUNT_CELL_KEYS.bruto]);
    // Sin neto explícito, el neto ES el bruto (fila sin descuento aplicado).
    const neto = rowKeyForCandidates(row, [...NETO_KEYS]) ? classroomRowNumber(row, [...NETO_KEYS]) : bruto;
    const yaCubiertos = classroomRowNumber(row, [...CUBIERTOS_KEYS]);
    const aporteNeto = rowKeyForCandidates(row, [...APORTE_KEYS]) ? classroomRowNumber(row, [...APORTE_KEYS]) : neto;
    const acc = porEstrato.get(estrato) ?? { estrato, aulas: 0, bruto: 0, neto: 0, yaCubiertos: 0, aporteNeto: 0 };
    acc.aulas += 1;
    acc.bruto += bruto;
    acc.neto += neto;
    acc.yaCubiertos += yaCubiertos;
    acc.aporteNeto = (acc.aporteNeto ?? 0) + aporteNeto;
    porEstrato.set(estrato, acc);
  }
  const estratos = ordenarEstratos(Array.from(porEstrato.values()));
  return { estratos, total: totalizar(estratos) };
}

/**
 * Resumen por estrato del BLOQUE del engine (`sequential_discount.por_estrato`,
 * claves congeladas stratum / aulas_seleccionadas / eligible_bruto_total /
 * eligible_neto_total / ya_cubiertos_total). Se usa como fallback cuando las
 * filas de la selección no traen columnas por aula. El bloque no trae aporte
 * neto por estrato (aporteNeto = null ⇒ la UI muestra "—").
 */
export function normalizeDescuentoResumenBloque(
  bloque: CalcMuestraAulasSelectionDescuento | null | undefined,
): DescuentoResumen | null {
  const filas = rowsFrom<Record<string, unknown>>(bloque?.por_estrato)
    .map((row): DescuentoResumenEstrato | null => {
      if (!rowKeyForCandidates(row, ["eligible_bruto_total", "eligible_neto_total"])) return null;
      return {
        estrato: classroomRowText(row, ["stratum"]) || "Sin estrato",
        aulas: classroomRowNumber(row, ["aulas_seleccionadas"]),
        bruto: classroomRowNumber(row, ["eligible_bruto_total"]),
        neto: classroomRowNumber(row, ["eligible_neto_total"]),
        yaCubiertos: classroomRowNumber(row, ["ya_cubiertos_total"]),
        aporteNeto: null,
      };
    })
    .filter((row): row is DescuentoResumenEstrato => row != null);
  if (!filas.length) return null;
  const estratos = ordenarEstratos(filas);
  return { estratos, total: totalizar(estratos) };
}

/** Modo aplicado por el engine; "off", ausente o no reconocido ⇒ null (sin UI de descuento). */
export function resolveDiscountMode(
  selection: Pick<CalcMuestraAulasSelection, "sequential_discount"> | null | undefined,
): DiscountMode | null {
  const raw = String(selection?.sequential_discount?.mode ?? "").trim().toLowerCase();
  if (raw === "sequential") return "sequential";
  if (raw === "post_hoc" || raw === "posthoc" || raw === "post-hoc") return "post_hoc";
  return null;
}

export function discountModeLabel(mode: DiscountMode): string {
  return mode === "sequential"
    ? "Descuento secuencial durante la selección"
    : "Descuento como auditoría posterior a la selección";
}

export function discountModeDetalle(mode: DiscountMode): string {
  return mode === "sequential"
    ? "Al elegir cada curso-horario, sus alumnos se descontaron de las candidatas restantes: los elegibles netos reflejan el aporte real de cada aula."
    : "El sorteo balanceado conserva sus probabilidades de diseño; el descuento se calculó después de seleccionar, como auditoría de cuánto aporta de verdad cada aula.";
}

/** Engines balanceados: en ellos el descuento del engine opera post-selección. */
export function isBalancedEngine(selectorEngine: string | null | undefined): boolean {
  const key = String(selectorEngine ?? "").trim().toLowerCase();
  return key === "cube_balanceado" || key === "local_pivotal_balanceado" || key === "pps_balanceado";
}

export type DescuentoSinIdsAviso = {
  code: typeof DESCUENTO_SIN_IDS_CODE;
  message: string;
};

const DESCUENTO_SIN_IDS_DEFAULT_MESSAGE =
  "El marco no tiene identificadores de estudiante parseables, así que la selección se ejecutó SIN descuento de repetidos: los elegibles mostrados son brutos.";

/**
 * Detecta el warning estructurado `descuento_sin_ids` del bloque del engine
 * (`warning_code` congelado; el detalle humano puede venir en `warnings`).
 */
export function findDescuentoSinIds(
  selection: Pick<CalcMuestraAulasSelection, "sequential_discount"> | null | undefined,
): DescuentoSinIdsAviso | null {
  const bloque = selection?.sequential_discount;
  if (!bloque || typeof bloque !== "object") return null;
  const code = String(bloque.warning_code ?? "").trim().toLowerCase();
  if (code !== DESCUENTO_SIN_IDS_CODE) return null;
  const detalle = (Array.isArray(bloque.warnings) ? bloque.warnings : [])
    .map((item) => String(item ?? "").trim())
    .find(Boolean);
  return { code: DESCUENTO_SIN_IDS_CODE, message: detalle || DESCUENTO_SIN_IDS_DEFAULT_MESSAGE };
}

export type StaleJobAviso = {
  jobId: string;
  kind: string;
  kindLabel: string;
  frameHash: string;
  detectedAt: string;
};

/** Etiquetas humanas de los jobs de la mesa (mismos ids que emite el router R). */
const STALE_JOB_KIND_LABELS: Record<string, string> = {
  calc_muestra_aulas_comparar: "Comparar métodos",
  calc_muestra_aulas_seleccionar: "Seleccionar cursos-horario titulares",
  calc_muestra_aulas_simular_reemplazos: "Probar reemplazos",
};

/**
 * Normaliza `state.aulas.stale_job_result` ({job_id, kind, frame_hash,
 * detected_at} | null): el guard del backend conserva aparte el resultado de
 * un job que llegó con un frame_hash viejo en vez de pisar la mesa vigente.
 */
export function normalizeStaleJobAviso(raw: Record<string, unknown> | null | undefined): StaleJobAviso | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = String(raw.kind ?? "").trim();
  const jobId = String(raw.job_id ?? "").trim();
  if (!kind && !jobId) return null;
  return {
    jobId,
    kind,
    kindLabel: STALE_JOB_KIND_LABELS[kind] ?? (kind || "job de la mesa de aulas"),
    frameHash: String(raw.frame_hash ?? "").trim(),
    detectedAt: String(raw.detected_at ?? "").trim(),
  };
}
