// Contrato de corte de Monitoreo.
//
// Antes de este módulo cada superficie de Avance inventaba su propio conteo: la
// misma operación mostraba 36 respuestas recibidas, 22 que pasan filtro, "100% de
// 24 entrevistas" y 0 válidas según dónde mirases. La causa no era un cálculo
// malo sino la ausencia de un vocabulario compartido para decir *de qué número
// estamos hablando*.
//
// Acá viven los tres granos con nombre y la única regla que gobierna las salidas.

export type MonitoreoCorteGrano = "ingesta" | "procesable" | "oficial";

/** Estado visual canónico. El verde vive solo en `listo`. */
export type MonitoreoEstadoVisual =
  | "sin-configurar"
  | "no-evaluado"
  | "parcial"
  | "bloqueado"
  | "listo";

export type MonitoreoGenerationStatus = "complete" | "partial" | "stale" | "failed" | string;

/**
 * Un salto entre granos. Cuando el número que ve el usuario baja, esto explica
 * por qué y a dónde ir para revisarlo.
 */
export type MonitoreoCorteSalto = {
  de: MonitoreoCorteGrano;
  a: MonitoreoCorteGrano;
  descartados: number;
  regla: string;
  /** Dirección canónica del bloqueo (`seccion=...&pestana=...`). */
  direccion?: string;
};

export type MonitoreoCorte = {
  /** Filas crudas del snapshot. Solo puede rotularse como "registros del snapshot". */
  ingesta: number;
  /** Casos elegibles que pasan el filtro de fuente. `null` = no determinado. */
  procesable: number | null;
  /** Válidas defendibles que cuentan como avance. `null` = no determinado. */
  oficial: number | null;
  meta: number | null;
  brecha: number | null;
  avancePct: number | null;
  cutAt: string;
  hasSnapshot: boolean;
  generationStatus: MonitoreoGenerationStatus;
  saltos: MonitoreoCorteSalto[];
  /** Fuentes conectadas y sincronizadas / fuentes que el modelo exige. */
  fuentes: { activas: number; requeridas: number } | null;
};

export type MonitoreoCorteInput = {
  ingesta?: number | null;
  procesable?: number | null;
  oficial?: number | null;
  meta?: number | null;
  cutAt?: string | null;
  hasSnapshot?: boolean;
  generationStatus?: MonitoreoGenerationStatus | null;
  reglaProcesable?: string;
  direccionProcesable?: string;
  reglaOficial?: string;
  direccionOficial?: string;
  fuentesActivas?: number | null;
  fuentesRequeridas?: number | null;
};

function conteo(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function conteoObligatorio(value: number | null | undefined): number {
  return conteo(value) ?? 0;
}

export function construirCorte(input: MonitoreoCorteInput): MonitoreoCorte {
  const ingesta = conteoObligatorio(input.ingesta);
  const procesable = conteo(input.procesable);
  const oficial = conteo(input.oficial);
  const meta = conteo(input.meta);

  const saltos: MonitoreoCorteSalto[] = [];
  if (procesable != null && ingesta > procesable) {
    saltos.push({
      de: "ingesta",
      a: "procesable",
      descartados: ingesta - procesable,
      regla: input.reglaProcesable || "Respuestas que no pasan el filtro de la fuente.",
      direccion: input.direccionProcesable,
    });
  }
  const base = procesable ?? ingesta;
  if (oficial != null && base > oficial) {
    saltos.push({
      de: procesable != null ? "procesable" : "ingesta",
      a: "oficial",
      descartados: base - oficial,
      regla: input.reglaOficial || "Casos en revisión o no defendibles que no cuentan como avance.",
      direccion: input.direccionOficial,
    });
  }

  const fuentesRequeridas = conteo(input.fuentesRequeridas);
  const brecha = meta != null && oficial != null ? Math.max(0, meta - oficial) : null;
  const avancePct = meta != null && meta > 0 && oficial != null
    ? (oficial / meta) * 100
    : null;

  return {
    ingesta,
    procesable,
    oficial,
    meta,
    brecha,
    avancePct,
    cutAt: input.cutAt || "",
    hasSnapshot: input.hasSnapshot ?? ingesta > 0,
    generationStatus: input.generationStatus || "partial",
    saltos,
    fuentes: fuentesRequeridas != null
      ? { activas: conteo(input.fuentesActivas) ?? 0, requeridas: fuentesRequeridas }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Gate de salidas
// ---------------------------------------------------------------------------

export type MonitoreoBloqueoSalida = {
  codigo:
    | "SIN_CORTE"
    | "OFICIAL_INDETERMINADO"
    | "SIN_VALIDAS"
    | "CORTE_INCOMPLETO"
    | "FUENTES_INCOMPLETAS";
  mensaje: string;
  direccion?: string;
};

export type MonitoreoSalidaReadiness = {
  estado: MonitoreoEstadoVisual;
  /** Único predicado autorizado para habilitar una salida de cliente. */
  puedePublicarCliente: boolean;
  bloqueos: MonitoreoBloqueoSalida[];
};

/**
 * Regla de la casa: una salida de cliente exige corte completo y avance oficial
 * mayor que cero. El conteo crudo del snapshot no habilita nada — ese era el
 * defecto que permitía emitir un PDF "oficial" con cero válidas.
 */
export function readinessDeSalidas(corte: MonitoreoCorte): MonitoreoSalidaReadiness {
  const bloqueos: MonitoreoBloqueoSalida[] = [];

  if (!corte.hasSnapshot) {
    bloqueos.push({
      codigo: "SIN_CORTE",
      mensaje: "Sincroniza un corte antes de generar salidas.",
      direccion: "seccion=fuentes",
    });
  } else {
    if (corte.oficial == null) {
      bloqueos.push({
        codigo: "OFICIAL_INDETERMINADO",
        mensaje: "El avance oficial todavía no está determinado para este corte.",
        direccion: corte.saltos.find((salto) => salto.a === "oficial")?.direccion ?? "seccion=avance&pestana=resumen",
      });
    } else if (corte.oficial === 0) {
      bloqueos.push({
        codigo: "SIN_VALIDAS",
        mensaje: "El corte no tiene respuestas válidas: no hay nada defendible que publicar.",
        direccion: corte.saltos.find((salto) => salto.a === "oficial")?.direccion ?? "seccion=avance&pestana=resumen",
      });
    }
    if (corte.generationStatus !== "complete") {
      bloqueos.push({
        codigo: "CORTE_INCOMPLETO",
        mensaje: "El corte está incompleto o desactualizado; vuelve a sincronizar antes de publicar.",
        direccion: "seccion=fuentes",
      });
    }
    // Telefónico declaraba "2/3 fuentes · Falta Kobo" en Fuentes y, dos pestañas
    // más allá, 9 efectivas listas para publicar. Una fuente faltante no puede
    // convivir con una salida oficial.
    if (corte.fuentes && corte.fuentes.activas < corte.fuentes.requeridas) {
      const faltan = corte.fuentes.requeridas - corte.fuentes.activas;
      bloqueos.push({
        codigo: "FUENTES_INCOMPLETAS",
        mensaje: `Falta${faltan === 1 ? "" : "n"} ${faltan} de ${corte.fuentes.requeridas} fuentes del modelo: el conteo no cubre todo el estudio.`,
        direccion: "seccion=fuentes",
      });
    }
  }

  return {
    estado: estadoDeSalidas(corte, bloqueos),
    puedePublicarCliente: bloqueos.length === 0,
    bloqueos,
  };
}

function estadoDeSalidas(corte: MonitoreoCorte, bloqueos: MonitoreoBloqueoSalida[]): MonitoreoEstadoVisual {
  if (!corte.hasSnapshot) return "sin-configurar";
  if (corte.oficial == null) return "no-evaluado";
  if (bloqueos.length) return "bloqueado";
  return "listo";
}

// ---------------------------------------------------------------------------
// Máquina de estados visual
// ---------------------------------------------------------------------------

export type EvidenciaVisual = {
  /** El estudio declaró lo necesario para que este control exista. */
  configurado?: boolean;
  /** El control llegó a ejecutarse sobre el corte. */
  evaluado?: boolean;
  /** Falta un prerrequisito aguas arriba. */
  bloqueado?: boolean;
  /** La evidencia está completa (sin brecha, sin faltantes). */
  completo?: boolean;
};

/**
 * Traduce evidencia a estado visual. Sustituye al viejo `readyStatus()`, que era
 * binario —verde si había filas— y por eso pintaba "4 actores" igual que
 * "corte listo".
 */
export function estadoVisual(evidencia: EvidenciaVisual): MonitoreoEstadoVisual {
  if (evidencia.configurado === false) return "sin-configurar";
  if (evidencia.bloqueado) return "bloqueado";
  if (evidencia.evaluado === false) return "no-evaluado";
  return evidencia.completo ? "listo" : "parcial";
}

/** Verde exclusivamente para `listo`. Ningún llamador debe decidirlo por su cuenta. */
export function esTonoExito(estado: MonitoreoEstadoVisual) {
  return estado === "listo";
}

const ETIQUETAS_ESTADO: Record<MonitoreoEstadoVisual, string> = {
  "sin-configurar": "Sin configurar",
  "no-evaluado": "No evaluado",
  parcial: "Parcial",
  bloqueado: "Bloqueado",
  listo: "Listo",
};

export function etiquetaEstado(estado: MonitoreoEstadoVisual) {
  return ETIQUETAS_ESTADO[estado];
}

// ---------------------------------------------------------------------------
// Tabla honesta
// ---------------------------------------------------------------------------

export type RecorteTabla<T> = {
  visibles: readonly T[];
  total: number;
  recortado: boolean;
  /** Rótulo obligatorio cuando hay recorte. Vacío cuando se muestra todo. */
  etiqueta: string;
};

/**
 * Ninguna tabla de Monitoreo puede recortar en silencio. Aulas limitaba a ocho
 * columnas y ochenta filas mientras Agenda pedía nueve, así que origen y
 * recopilador desaparecían sin aviso.
 */
export function recorteTabla<T>(
  rows: readonly T[],
  limite: number,
  sustantivo: "fila" | "columna" = "fila",
): RecorteTabla<T> {
  const total = rows.length;
  if (!Number.isFinite(limite) || limite <= 0 || total <= limite) {
    return { visibles: rows, total, recortado: false, etiqueta: "" };
  }
  const plural = sustantivo === "fila" ? "filas" : "columnas";
  return {
    visibles: rows.slice(0, limite),
    total,
    recortado: true,
    etiqueta: `Mostrando ${limite} de ${total.toLocaleString("es-PE")} ${plural}`,
  };
}

// ---------------------------------------------------------------------------
// Formato de avance
// ---------------------------------------------------------------------------

/**
 * Un porcentaje sin denominador es una afirmación sin respaldo: "100% de
 * representatividad" con cero cursos aplicados venía de acá. Este formateador
 * obliga a que el numerador y el denominador viajen juntos.
 */
export function textoAvance(oficial: number | null, meta: number | null) {
  if (oficial == null) return "S/D";
  const valor = oficial.toLocaleString("es-PE");
  if (meta == null || meta <= 0) return `${valor} sin meta declarada`;
  return `${valor} de ${meta.toLocaleString("es-PE")}`;
}

/**
 * El anillo de avance recortaba la barra con clamp pero imprimía el valor real,
 * así que un 107% aparecía mudo. Sobre-cumplir es una noticia y se dice con
 * palabras.
 */
export function textoSobrecumplimiento(oficial: number | null, meta: number | null) {
  if (oficial == null || meta == null || meta <= 0) return "";
  if (oficial <= meta) return "";
  return `Meta superada, +${(oficial - meta).toLocaleString("es-PE")}`;
}
