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
