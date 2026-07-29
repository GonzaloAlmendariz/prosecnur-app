/**
 * Por qué un caso de acreditación no cruzó con la base, en concreto.
 *
 * La bandeja de subsanación mostraba la misma frase en los 269 accionables
 * ("Respuesta completa o parcial sin cruce: puede vincularse..."), que es la
 * regla que los agrupa, no lo que le pasa a cada uno. Sin distinguirlos no hay
 * forma de elegir cuál trabajar ni de agrupar el trabajo por tipo de arreglo.
 *
 * Este modelo lee la evidencia que ya viaja en el caso y responde dos cosas:
 * qué falló y qué se hace con eso.
 */

export type MotivoDeNoCruceClave =
  | "sin-respuesta"
  | "rechazo"
  | "sin-llave"
  | "solo-auxiliar"
  | "duplicado"
  | "llave-fuera-de-base"
  | "sin-base"
  | "sin-clasificar";

/**
 * Cuánto importa el caso. No todo no cruce es igual de grave:
 *
 * - `recuperable`: hay una respuesta completa que se pierde solo por el
 *   vínculo. Es la que mueve el avance si se resuelve, así que va primero.
 * - `revisable`: falta algo que sí debía estar; vale mirarlo.
 * - `esperable`: la ausencia se explica por el canal o por el estado de la
 *   respuesta, y resolverla no sumaría una efectiva.
 */
export type PrioridadDeCaso = "recuperable" | "revisable" | "esperable";

export const ORDEN_DE_PRIORIDAD: Record<PrioridadDeCaso, number> = {
  recuperable: 0,
  revisable: 1,
  esperable: 2,
};

export const ETIQUETA_DE_PRIORIDAD: Record<PrioridadDeCaso, string> = {
  recuperable: "Recuperable",
  revisable: "Por revisar",
  esperable: "Esperable",
};

export type MotivoDeNoCruce = {
  clave: MotivoDeNoCruceClave;
  /** Frase corta para la fila de la bandeja. Nombra el hecho, no la regla. */
  etiqueta: string;
  /** El gesto concreto que resuelve este motivo. */
  queHacer: string;
  prioridad: PrioridadDeCaso;
};

/** Lo mínimo que el modelo necesita leer de un caso. */
export type CasoParaMotivo = {
  primary_identity_label?: string | null;
  primary_identity_value?: string | null;
  secondary_identity_label?: string | null;
  secondary_identity_value?: string | null;
  base_record?: string | null;
  base_source?: string | null;
  duplicate_count?: number | null;
  duplicate_group_size?: number | null;
  channel_key_strategy?: string | null;
  partial_completion_pct?: number | null;
};

/**
 * Estrategias donde la llave es una pregunta DENTRO del cuestionario
 * (`.monitoreo_internal_strategy_label` en monitoreo_engine.R). Quien cortó
 * antes de llegar a ella no la contestó: la ausencia es del recorrido, no un
 * fallo de captura. Por correo, en cambio, la llave viaja en la metadata del
 * envío y no depende de que la persona escriba nada.
 */
const ESTRATEGIAS_QUE_PREGUNTAN_LA_LLAVE = new Set([
  "telefono_enlace_y_codigo_final",
  "pregunta_pucp_whatsapp",
  "pregunta_pucp_qr",
]);

/** Umbral de avance a partir del cual una parcial ya recorrió lo suficiente. */
const PARCIAL_AVANZADA_PCT = 60;

export function llaveDependeDeLaRespuesta(estrategia: unknown) {
  return ESTRATEGIAS_QUE_PREGUNTAN_LA_LLAVE.has(texto(estrategia).toLowerCase());
}

function prioridadDelCaso(
  caso: CasoParaMotivo,
  estadoDeRespuesta: EstadoDeRespuesta,
): PrioridadDeCaso {
  if (estadoDeRespuesta === "pending" || estadoDeRespuesta === "refusal") return "esperable";
  if (estadoDeRespuesta === "complete") return "recuperable";
  if (estadoDeRespuesta !== "partial") return "revisable";
  // Una parcial cuyo canal identificaba por metadata debía traer llave igual.
  if (!llaveDependeDeLaRespuesta(caso.channel_key_strategy)) return "revisable";
  return numero(caso.partial_completion_pct) >= PARCIAL_AVANZADA_PCT ? "revisable" : "esperable";
}

/** Estado de respuesta ya clasificado por `internalCaseResponseStateValue`. */
export type EstadoDeRespuesta = "complete" | "partial" | "refusal" | "pending" | string;

/** Cruce ya clasificado por `internalCaseCrossingValue`. */
export type ValorDeCruce = string;

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function numero(valor: unknown) {
  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Recorta un valor de llave largo para que quepa en la fila sin ocultar el final. */
export function llaveBreve(valor: string, maximo = 22) {
  const limpio = texto(valor);
  if (limpio.length <= maximo) return limpio;
  const cabeza = Math.ceil((maximo - 1) / 2);
  const cola = Math.floor((maximo - 1) / 2);
  return `${limpio.slice(0, cabeza)}…${limpio.slice(limpio.length - cola)}`;
}

export function motivoDeNoCruce(
  caso: CasoParaMotivo,
  estadoDeRespuesta: EstadoDeRespuesta,
  valorDeCruce: ValorDeCruce,
): MotivoDeNoCruce {
  const principal = texto(caso.primary_identity_value);
  const auxiliar = texto(caso.secondary_identity_value);
  const etiquetaAuxiliar = texto(caso.secondary_identity_label) || "un dato auxiliar";
  const registroEnBase = texto(caso.base_record) || texto(caso.base_source);
  const duplicados = Math.max(numero(caso.duplicate_count), numero(caso.duplicate_group_size));
  const cruce = texto(valorDeCruce);
  const prioridad = prioridadDelCaso(caso, estadoDeRespuesta);
  const laLlaveEraUnaPregunta = llaveDependeDeLaRespuesta(caso.channel_key_strategy);

  if (estadoDeRespuesta === "pending") {
    return {
      clave: "sin-respuesta",
      etiqueta: "No llegó a responder",
      queHacer: "No hay respuesta que mover al avance. Queda en la lista de no respuesta.",
      prioridad,
    };
  }

  if (estadoDeRespuesta === "refusal") {
    return {
      clave: "rechazo",
      etiqueta: "Rechazó sin identificarse",
      queHacer: "Sin llave no se puede asignar al universo. Se documenta el rechazo y se cierra.",
      prioridad,
    };
  }

  if (cruce === "sin_base") {
    return {
      clave: "sin-base",
      etiqueta: "No hay base para cruzar",
      queHacer: "Falta cargar la base del actor. Hasta entonces ningún caso suyo puede cruzar.",
      prioridad,
    };
  }

  if (!principal && !auxiliar) {
    // Por teléfono, WhatsApp o QR el código se pregunta dentro del cuestionario:
    // quien cortó antes nunca lo vio. Por correo la llave viaja en el envío, así
    // que su ausencia sí señala una captura rota.
    const cortoAntesDeLaPregunta = laLlaveEraUnaPregunta && estadoDeRespuesta !== "complete";
    return {
      clave: "sin-llave",
      etiqueta: cortoAntesDeLaPregunta
        ? "Cortó antes de la pregunta de código"
        : "No dejó ningún dato de identidad",
      queHacer: cortoAntesDeLaPregunta
        ? "El canal pedía el código dentro del cuestionario y no llegó hasta ahí. Sin llave no hay vínculo posible."
        : "Recupera la llave desde el recopilador o la lista de convocatoria; sin ella el caso no se puede vincular.",
      prioridad,
    };
  }

  if (!principal && auxiliar) {
    return {
      clave: "solo-auxiliar",
      etiqueta: `Solo dejó ${etiquetaAuxiliar.toLocaleLowerCase("es")}`,
      queHacer: `Busca en la base por ${etiquetaAuxiliar.toLocaleLowerCase("es")} (${llaveBreve(auxiliar)}) y confirma a quién corresponde.`,
      prioridad,
    };
  }

  if (duplicados > 1) {
    return {
      clave: "duplicado",
      etiqueta: `Llave repetida en ${duplicados} respuestas`,
      queHacer: "Elige cuál respuesta cuenta —la de mayor duración— y deja las otras como trazabilidad.",
      prioridad,
    };
  }

  if (!registroEnBase) {
    return {
      clave: "llave-fuera-de-base",
      etiqueta: `La llave ${llaveBreve(principal)} no está en la base`,
      queHacer: "Compruébala contra la base del actor: puede estar mal escrita, o la persona no estaba en la lista.",
      prioridad,
    };
  }

  return {
    clave: "sin-clasificar",
    etiqueta: "No cruzó, sin causa identificada",
    queHacer: "Abre la ficha y revisa la evidencia de llave para determinar qué falta.",
    prioridad,
  };
}

/** Los grupos de la bandeja, en el orden en que conviene trabajarlos. */
export const GRUPOS_DE_SUBSANACION: {
  prioridad: PrioridadDeCaso;
  titulo: string;
  detalle: string;
}[] = [
  {
    prioridad: "recuperable",
    titulo: "Recuperables",
    detalle: "completas: solo les falta el vínculo",
  },
  {
    prioridad: "revisable",
    titulo: "Por revisar",
    detalle: "falta un dato que el canal debía traer",
  },
  {
    prioridad: "esperable",
    titulo: "Explicados por el canal",
    detalle: "resolverlos no suma efectivas",
  },
];

/**
 * Ordena para trabajar: primero lo recuperable —una completa que se pierde solo
 * por el vínculo—, al final lo que el canal ya explica.
 */
export function compararPorPrioridad(
  a: MotivoDeNoCruce,
  b: MotivoDeNoCruce,
) {
  return ORDEN_DE_PRIORIDAD[a.prioridad] - ORDEN_DE_PRIORIDAD[b.prioridad];
}

/** Cuenta casos por motivo, del más frecuente al menos, para agrupar el trabajo. */
export function resumenDeMotivos(
  motivos: MotivoDeNoCruce[],
): { clave: MotivoDeNoCruceClave; etiqueta: string; total: number }[] {
  const acumulado = new Map<MotivoDeNoCruceClave, { etiqueta: string; total: number }>();
  motivos.forEach((motivo) => {
    const previo = acumulado.get(motivo.clave);
    if (previo) {
      previo.total += 1;
      return;
    }
    acumulado.set(motivo.clave, { etiqueta: motivo.etiqueta, total: 1 });
  });
  return Array.from(acumulado.entries())
    .map(([clave, valor]) => ({ clave, etiqueta: valor.etiqueta, total: valor.total }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave, "es"));
}
