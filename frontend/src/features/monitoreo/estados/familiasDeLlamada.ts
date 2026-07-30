/**
 * Catálogo canónico de estados de llamada.
 *
 * La hoja de barrido la escribe el cliente, y su vocabulario es suyo: en
 * acrconta conviven once categorías crudas —incluida `Número Incorrrecto`, con
 * tres erres— que la franja de contexto publicaba tal cual, truncadas y con
 * puntos de color casi indistinguibles. La superficie más visible del módulo
 * no puede ser el volcado literal de una columna ajena.
 *
 * Acá el crudo se agrupa en familias operativas estables. El valor
 * original NO se pierde: viaja como detalle para trazabilidad, que es lo que
 * un comité pide cuando pregunta por qué un caso no entró.
 */

export type AcreditacionFamiliaLlamada =
  | "efectivo"
  | "sin_contacto"
  | "numero_invalido"
  | "rechazo"
  | "sin_barrer"
  | "otro";

export type AcreditacionEstadoCanonico = {
  familia: AcreditacionFamiliaLlamada;
  label: string;
  /** Cómo leerlo: define el tono y el orden en la leyenda. */
  tono: "good" | "warn" | "risk" | "unswept";
};

/**
 * Color por defecto de cada familia.
 *
 * Vive aquí y en ningún otro sitio. Estaba escrito a mano en el `style` de cada
 * vista —`#168a55`, `#5e7fa5`, `#a61d4f` repetidos— y por eso no había forma de
 * cambiarlo desde un lugar. Es un DEFECTO, no una decisión: en cuanto el
 * usuario declara el suyo en el definidor de estados, manda el suyo.
 */
export const ACREDITACION_COLOR_FAMILIA: Record<AcreditacionFamiliaLlamada, string> = {
  efectivo: "#168a55",
  sin_contacto: "#5e7fa5",
  numero_invalido: "#8a6d3b",
  rechazo: "#a61d4f",
  sin_barrer: "#94a3b8",
  otro: "#6b5ca5",
};

const CATALOGO: Record<AcreditacionFamiliaLlamada, AcreditacionEstadoCanonico> = {
  efectivo: { familia: "efectivo", label: "Efectivo", tono: "good" },
  sin_contacto: { familia: "sin_contacto", label: "Sin contacto", tono: "warn" },
  numero_invalido: { familia: "numero_invalido", label: "Número inválido", tono: "risk" },
  rechazo: { familia: "rechazo", label: "Rechazo", tono: "risk" },
  sin_barrer: { familia: "sin_barrer", label: "Sin barrer", tono: "unswept" },
  // Un estado que no cae en ninguna familia conocida NO se disfraza de otra
  // cosa: se agrupa aparte y conserva su crudo. Meterlo a la fuerza en "sin
  // contacto" seria justo el tipo de reetiquetado silencioso que rompe la
  // trazabilidad del expediente.
  otro: { familia: "otro", label: "Otro estado", tono: "warn" },
};

/** Orden de lectura: primero lo que suma, al final lo que aún no se trabajó. */
export const ACREDITACION_ORDEN_FAMILIAS: AcreditacionFamiliaLlamada[] = [
  "efectivo",
  "sin_contacto",
  "numero_invalido",
  "rechazo",
  "otro",
  "sin_barrer",
];

function clave(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Clasifica un estado crudo del cliente en su familia operativa.
 *
 * Tolera los errores de tipeo reales de la hoja (`Incorrrecto`) porque el dato
 * no se puede corregir desde acá: se normaliza por raíz, no por igualdad.
 */
export function acreditacionFamiliaDeEstado(raw: unknown): AcreditacionEstadoCanonico {
  const k = clave(raw);
  if (!k) return CATALOGO.sin_barrer;

  if (/\bno\s+barrid/.test(k) || /\bpendiente\b/.test(k) || /\bsin\s+barrer\b/.test(k)) return CATALOGO.sin_barrer;
  // "No efectivo" y "no efectiva" NO son efectivos: la negación se descarta
  // antes de buscar la raíz positiva.
  if (/\bno\s+efectiv/.test(k)) return CATALOGO.sin_contacto;
  if (/\befectiv/.test(k) || /\bcompleta/.test(k) || /\blogrado\b/.test(k)) return CATALOGO.efectivo;
  if (/\brechaz/.test(k) || /\bnegativ/.test(k)) return CATALOGO.rechazo;
  if (/incorr/.test(k) || /\bno\s+existe/.test(k) || /\bsuspend/.test(k) || /fuera\s+de\s+servicio/.test(k) || /\berrad/.test(k)) {
    return CATALOGO.numero_invalido;
  }
  if (
    /\bno\s+contesta/.test(k) || /\bapagad/.test(k) || /\bocupad/.test(k) || /\bbuzon\b/.test(k)
    || /contact/.test(k) || /\bvolver\b/.test(k) || /reprogram/.test(k)
  ) {
    return CATALOGO.sin_contacto;
  }
  return CATALOGO.otro;
}

export type AcreditacionEstadoAgrupado = AcreditacionEstadoCanonico & {
  value: number;
  /** Etiquetas originales del cliente que caen en esta familia, con su conteo. */
  detalle: Array<{ label: string; value: number }>;
};

/** Agrupa filas de estado crudo en las familias canónicas, conservando el detalle. */
export function acreditacionAgruparEstados(
  entradas: Array<{ label: string; value: number }>,
): AcreditacionEstadoAgrupado[] {
  const porFamilia = new Map<AcreditacionFamiliaLlamada, AcreditacionEstadoAgrupado>();

  for (const entrada of entradas) {
    const value = Number(entrada.value) || 0;
    if (value <= 0) continue;
    const canonico = acreditacionFamiliaDeEstado(entrada.label);
    const actual = porFamilia.get(canonico.familia) ?? { ...canonico, value: 0, detalle: [] };
    actual.value += value;
    actual.detalle.push({ label: String(entrada.label ?? "").trim(), value });
    porFamilia.set(canonico.familia, actual);
  }

  return ACREDITACION_ORDEN_FAMILIAS
    .map((familia) => porFamilia.get(familia))
    .filter((item): item is AcreditacionEstadoAgrupado => Boolean(item))
    .map((item) => ({
      ...item,
      detalle: [...item.detalle].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es")),
    }));
}

// ---------------------------------------------------------------------------
// Declaración del usuario
// ---------------------------------------------------------------------------
//
// La heurística de arriba acierta casi siempre, pero «casi» no basta cuando el
// vocabulario lo escribe el cliente y cambia entre estudios. Lo que sigue deja
// que el usuario CONFIRME lo detectado: a qué familia va cada etiqueta cruda y
// de qué color se pinta cada familia.
//
// Se persiste en `operational_model.state_rules`, que ya viaja en el `.pulso`
// —`outcome_values` son los crudos asignados y `final_state` la familia—, así
// que no hay contrato nuevo. El campo `color` se añadió a la whitelist de R
// (`monitoreo_engine.R`), porque si no se nombra ahí se descarta al guardar.

import type { MonitoreoStateRule } from "../../../../api/client";

/** Lo que el usuario declaró para una familia. */
export type AcreditacionDeclaracionEstado = {
  familia: AcreditacionFamiliaLlamada;
  color: string;
  /** Etiquetas crudas que el usuario asignó a mano a esta familia. */
  crudos: string[];
};

function esFamilia(value: unknown): value is AcreditacionFamiliaLlamada {
  return typeof value === "string" && value in CATALOGO;
}

/** Lee las declaraciones guardadas, ignorando reglas que no son de estado. */
export function acreditacionDeclaracionesDesdeReglas(
  reglas: readonly MonitoreoStateRule[] = [],
): AcreditacionDeclaracionEstado[] {
  return reglas
    .filter((regla) => esFamilia(regla.final_state))
    .map((regla) => ({
      familia: regla.final_state as AcreditacionFamiliaLlamada,
      color: String((regla as { color?: string }).color ?? "").trim(),
      crudos: (regla.outcome_values ?? []).map((valor) => String(valor ?? "").trim()).filter(Boolean),
    }));
}

/** Color efectivo de una familia: el declarado si existe, si no el de fábrica. */
export function acreditacionColorDeFamilia(
  familia: AcreditacionFamiliaLlamada,
  declaraciones: readonly AcreditacionDeclaracionEstado[] = [],
): string {
  const declarado = declaraciones.find((item) => item.familia === familia)?.color;
  return declarado || ACREDITACION_COLOR_FAMILIA[familia];
}

/**
 * Familia de un estado crudo, respetando lo que el usuario haya confirmado.
 *
 * La asignación manual gana SIEMPRE sobre la heurística: si alguien se tomó el
 * trabajo de decir que «Contactado por WhatsApp» es efectivo en su estudio, la
 * regex no puede sobreescribirlo en el siguiente corte.
 */
export function acreditacionFamiliaDeclarada(
  raw: unknown,
  declaraciones: readonly AcreditacionDeclaracionEstado[] = [],
): AcreditacionEstadoCanonico {
  const k = clave(raw);
  if (k) {
    const manual = declaraciones.find((item) => item.crudos.some((crudo) => clave(crudo) === k));
    if (manual) return CATALOGO[manual.familia];
  }
  return acreditacionFamiliaDeEstado(raw);
}

/**
 * Los estados crudos que trae el corte, listos para confirmarse.
 *
 * Es lo que el definidor muestra: qué encontró la app en la hoja de barrido de
 * ESTE estudio, dónde lo puso, y si esa decisión la tomó el usuario o la
 * heurística. Sin esta distinción, confirmar no significa nada.
 */
export type AcreditacionEstadoDetectado = {
  crudo: string;
  value: number;
  familia: AcreditacionFamiliaLlamada;
  confirmado: boolean;
};

export function acreditacionEstadosDetectados(
  entradas: Array<{ label: string; value: number }>,
  declaraciones: readonly AcreditacionDeclaracionEstado[] = [],
): AcreditacionEstadoDetectado[] {
  const porCrudo = new Map<string, AcreditacionEstadoDetectado>();

  for (const entrada of entradas) {
    const crudo = String(entrada.label ?? "").trim();
    const value = Number(entrada.value) || 0;
    if (!crudo || value <= 0) continue;
    const k = clave(crudo);
    const confirmado = declaraciones.some((item) => item.crudos.some((valor) => clave(valor) === k));
    const previo = porCrudo.get(k);
    if (previo) {
      previo.value += value;
      continue;
    }
    porCrudo.set(k, {
      crudo,
      value,
      familia: acreditacionFamiliaDeclarada(crudo, declaraciones).familia,
      confirmado,
    });
  }

  return [...porCrudo.values()].sort((a, b) => b.value - a.value || a.crudo.localeCompare(b.crudo, "es"));
}

/** Nombre legible de una familia, para selectores y leyendas. */
export function acreditacionEtiquetaDeFamilia(familia: AcreditacionFamiliaLlamada): string {
  return CATALOGO[familia].label;
}
