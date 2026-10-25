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
  /**
   * **Cómo se llama esa cifra en ESTE perfil.**
   *
   * La tarjeta de Salidas rotulaba siempre «meta N», y en aulas la cifra que
   * recibe es `avance_cuota$total$cuota` —la CUOTA del diseño, 2.500—, mientras
   * «meta» en esa misma sección nombra otra cosa: la suma de metas por
   * curso-horario, que son 3.227. Dos cifras distintas bajo la misma palabra, a
   * una pestaña de distancia.
   *
   * El número es correcto; lo que mentía era el nombre. Se deja que cada perfil
   * declare el suyo en vez de renombrar para todos: territorial y acreditación
   * sí publican una meta.
   */
  metaEtiqueta: string;
  /**
   * **Qué mide el procesable en ESTE perfil**, dicho bajo la cifra.
   *
   * La tarjeta rotulaba siempre «pasan el filtro», y en telefónico y
   * acreditación el procesable es la suma de universos declarados (2.296
   * personas por llamar), no un filtro: a dos pestañas, Control › Respuestas
   * dice «424 pasan el filtro de efectiva». Dos cifras distintas con casi el
   * mismo rótulo (QA final, C5). Cada adaptador declara lo que su grano mide.
   */
  procesableEtiqueta: string;
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
  /** Cómo se llama esa cifra en este perfil. Por defecto, «meta». */
  metaEtiqueta?: string;
  /** Qué mide el procesable en este perfil. Por defecto, «en el filtro de la fuente». */
  procesableEtiqueta?: string;
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
  const oficial = conteo(input.oficial);
  const meta = conteo(input.meta);

  // Guard de coherencia del embudo.
  //
  // No puede haber más oficiales que procesables: el oficial es un subconjunto
  // del procesable por definición. Cuando llega esa combinación el procesable
  // no es un conteo, es un hueco —típicamente una columna que faltaba y se leyó
  // como 0—, así que se declara indeterminado en vez de pintarse.
  //
  // Sin esto, Teléfono mostró `0 procesables → 534 efectivas` con «−1.277
  // registros fuera del universo», acusando de descarte a todo el snapshot,
  // mientras Modelo leía `519 → 418` del mismo corte. El guard previo era
  // `base > oficial`, que con un procesable en 0 nunca se cumple.
  const procesableDeclarado = conteo(input.procesable);
  const procesable = procesableDeclarado != null
    && oficial != null
    && procesableDeclarado < oficial
    ? null
    : procesableDeclarado;

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
    metaEtiqueta: input.metaEtiqueta || "meta",
    procesableEtiqueta: input.procesableEtiqueta || "en el filtro de la fuente",
    brecha,
    avancePct,
    cutAt: input.cutAt || "",
    hasSnapshot: input.hasSnapshot ?? ingesta > 0,
    // El vacío se queda vacío: «todavía no se generó» y «la última terminó
    // con errores» son historias distintas, y el colapso a "partial" hacía
    // que un estudio SIN primera sincronización se narrara como una que
    // FALLÓ («revisa Fuentes antes de publicar» sobre un sync_errors vacío,
    // medido en vivo 2026-09-03 pre-campo). El corte sigue bloqueado igual
    // (≠ "complete"); solo cambia que el mensaje dice la verdad.
    generationStatus: input.generationStatus || "",
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
  /** El hecho, corto y sin explicación encadenada. */
  mensaje: string;
  /**
   * Lo que se hace al respecto. Va en el `title` del botón que lleva a la
   * causa, no pegado al hecho tras un «;» (QA final: «…desde la última
   * sincronización; vuelve a sincronizar antes de publicar»).
   */
  accion?: string;
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
/**
 * Por qué este corte no se puede publicar, dicho por su nombre.
 *
 * El mensaje era uno solo —«El corte está incompleto o desactualizado; vuelve a
 * sincronizar»— para tres estados que significan cosas distintas y piden cosas
 * distintas, **teniendo el sistema el dato exacto**: `partial` es una
 * sincronización que terminó CON ERRORES (resincronizar puede no arreglar nada
 * si el error persiste), `stale` es un corte que quedó viejo (ahí sí basta
 * volver a sincronizar) y `failed` es una generación que no llegó a terminar.
 * Una disyunción deja al lector eligiendo entre dos diagnósticos cuando abajo
 * hay uno.
 *
 * El bloqueo de al lado, `FUENTES_INCOMPLETAS`, ya nombra su causa con las dos
 * cifras; éste se había quedado en el «o».
 */
function bloqueoDeCorteIncompleto(estado: MonitoreoGenerationStatus): { mensaje: string; accion: string } {
  if (estado === "partial") {
    return { mensaje: "La última sincronización terminó con errores.", accion: "Revisa Fuentes antes de publicar" };
  }
  if (estado === "stale") {
    return { mensaje: "El corte está desactualizado.", accion: "Vuelve a sincronizar antes de publicar" };
  }
  if (estado === "failed") {
    return { mensaje: "La generación del corte falló.", accion: "Vuelve a sincronizar desde Fuentes" };
  }
  // Un estado que el contrato no conoce todavía. Se dice que no está completo
  // —que es lo comprobado— y se nombra el valor en vez de inventarle una causa.
  return {
    mensaje: estado ? `El corte no está completo (estado «${estado}»).` : "El corte todavía no está completo.",
    accion: "Vuelve a sincronizar antes de publicar",
  };
}

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
        mensaje: "El avance oficial no está determinado en este corte.",
        accion: "Revisa de dónde sale la cifra oficial",
        direccion: corte.saltos.find((salto) => salto.a === "oficial")?.direccion ?? "seccion=avance&pestana=resumen",
      });
    } else if (corte.oficial === 0) {
      bloqueos.push({
        codigo: "SIN_VALIDAS",
        mensaje: "El corte no tiene respuestas válidas.",
        accion: "Revisa por qué ninguna respuesta cuenta",
        direccion: corte.saltos.find((salto) => salto.a === "oficial")?.direccion ?? "seccion=avance&pestana=resumen",
      });
    }
    if (corte.generationStatus !== "complete") {
      bloqueos.push({
        codigo: "CORTE_INCOMPLETO",
        ...bloqueoDeCorteIncompleto(corte.generationStatus),
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
        mensaje: `Falta${faltan === 1 ? "" : "n"} ${faltan} de ${corte.fuentes.requeridas} fuentes del modelo.`,
        accion: "Conecta las fuentes que faltan para que el conteo cubra el estudio",
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
  /**
   * Cuántas filas hay DE VERDAD, cuando el payload ya llegó recortado.
   *
   * Sin esto el denominador es el largo del array recibido, que en Aulas es el
   * tope del servidor: `MONITOREO_AULAS_COURSE_STATUS_TOPE` manda 500 filas de
   * un plan de 3.409, y el pie decía «Mostrando 400 de 500». Quien lo lee
   * concluye que faltan 100 y faltan 3.009 — un rótulo que promete otro número.
   *
   * Y cubre el caso peor, que no se ve: si el servidor manda MENOS que el tope
   * local (300 de 3.409), no hay recorte local, `recortado` era `false` y la
   * tabla no rotulaba nada. El truncado del servidor desaparecía en silencio,
   * que es justo lo que esta función existe para impedir.
   */
  totalReal?: number,
): RecorteTabla<T> {
  const total = Math.max(rows.length, Number.isFinite(totalReal) ? Number(totalReal) : 0);
  const cabenTodas = !Number.isFinite(limite) || limite <= 0 || rows.length <= limite;
  const visibles = cabenTodas ? rows : rows.slice(0, limite);
  if (visibles.length >= total) {
    return { visibles, total, recortado: false, etiqueta: "" };
  }
  const plural = sustantivo === "fila" ? "filas" : "columnas";
  return {
    visibles,
    total,
    recortado: true,
    etiqueta: `Mostrando ${visibles.length} de ${total.toLocaleString("es-PE")} ${plural}`,
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
