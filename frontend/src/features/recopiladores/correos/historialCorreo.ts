// =============================================================================
// historialCorreo.ts — deshacer y rehacer del editor de correos (E1g §2)
// =============================================================================
// Copia de `recopiladores/templateHistory.ts` para `MailTemplate`, con dos
// diferencias que pide el editor en el sitio:
//
// 1. **El texto se agrupa por palabra.** Ediciones seguidas del mismo bloque
//    y la misma propiedad, con menos de 1 s entre una y otra, son una sola
//    entrada mientras sigan la misma palabra: un espacio después de escribir,
//    pasar de escribir a borrar (o al revés) o una pausa abren otra. Un clic
//    en Deshacer quita la última palabra, no el campo entero (N6 del re-QA).
// 2. **El atajo no se apaga dentro de un editable.** `templateHistoryShortcut`
//    ignora los objetivos editables; aquí el editor en línea captura Cmd+Z
//    por su cuenta (primero vuelca lo pendiente, después deshace en la app).
//
// Las operaciones de estructura (mover, insertar, quitar, estilo, preset)
// entran siempre como entrada propia. El historial es por campaña: el store lo
// reinicia al cambiar de campaña o al cargar otra plantilla.

import type { MailTemplate } from "../../../api/materialMail";

export const LIMITE_DEL_HISTORIAL = 100;
export const VENTANA_DE_TEXTO_MS = 1000;

/** Qué hizo una edición de texto: escribir, borrar o reemplazar. */
export type ClaseDeEdicion = "escribir" | "borrar" | "reemplazar";

export type GrupoDeTexto = {
  clave: string;
  en: number;
  /** La clase de la última edición del grupo. */
  clase?: ClaseDeEdicion;
  /** ¿Lo último escrito cerró una palabra (un espacio o un signo)? */
  cerroPalabra?: boolean;
};

export type HistorialCorreo = {
  pasado: MailTemplate[];
  futuro: MailTemplate[];
  /** Grupo de texto abierto: clave `bloque.prop` y hora de la última edición. */
  grupo: GrupoDeTexto | null;
};

export const HISTORIAL_VACIO: HistorialCorreo = { pasado: [], futuro: [], grupo: null };

/** Qué cambió entre dos textos: lo quitado y lo puesto, sin el principio y el final comunes. */
export function edicionEntre(antes: string, despues: string): { clase: ClaseDeEdicion; puesto: string } {
  let i = 0;
  while (i < antes.length && i < despues.length && antes[i] === despues[i]) i += 1;
  let a = antes.length;
  let d = despues.length;
  while (a > i && d > i && antes[a - 1] === despues[d - 1]) { a -= 1; d -= 1; }
  const quitado = antes.slice(i, a);
  const puesto = despues.slice(i, d);
  return { clase: quitado && !puesto ? "borrar" : puesto && !quitado ? "escribir" : "reemplazar", puesto };
}

const FIN_DE_PALABRA = /[\s.,;:!?¡¿()«»"'\-]$/;

/** Cómo entra un cambio: un texto (agrupable) o una operación de estructura. */
export type TipoDeCambio = {
  texto: string;
  ahora: number;
  /** El texto entero antes y después (el borrador serializado sirve): de ahí sale la palabra. */
  antes?: string;
  despues?: string;
} | null;

/** ¿El cambio sigue la palabra del grupo abierto? */
function sigueElGrupo(grupo: GrupoDeTexto | null, cambio: NonNullable<TipoDeCambio>, clase: ClaseDeEdicion | undefined): boolean {
  if (!grupo || grupo.clave !== cambio.texto || cambio.ahora - grupo.en >= VENTANA_DE_TEXTO_MS) return false;
  if (!clase || !grupo.clase) return true;
  if (clase === "reemplazar" || clase !== grupo.clase) return false;
  // Una palabra nueva después de un espacio abre su propia entrada.
  return !(clase === "escribir" && grupo.cerroPalabra);
}

/**
 * Registra que `antes` pasó a ser el presente anterior a un cambio. Devuelve el
 * historial nuevo; el presente lo guarda quien llama (el borrador del store).
 */
export function registrarCambio(h: HistorialCorreo, antes: MailTemplate, cambio: TipoDeCambio): HistorialCorreo {
  const edicion = cambio && cambio.antes !== undefined && cambio.despues !== undefined ? edicionEntre(cambio.antes, cambio.despues) : null;
  const grupo: GrupoDeTexto | null = cambio
    ? { clave: cambio.texto, en: cambio.ahora, clase: edicion?.clase, cerroPalabra: edicion ? FIN_DE_PALABRA.test(edicion.puesto) : undefined }
    : null;
  if (cambio && sigueElGrupo(h.grupo, cambio, edicion?.clase)) {
    // Misma palabra, de corrido: la entrada abierta ya guarda el estado previo.
    return { ...h, futuro: [], grupo };
  }
  return {
    pasado: [...h.pasado, antes].slice(-LIMITE_DEL_HISTORIAL),
    futuro: [],
    grupo,
  };
}

/** Deshace: el presente pasa al futuro y vuelve el último del pasado. */
export function deshacer(h: HistorialCorreo, presente: MailTemplate): { historial: HistorialCorreo; presente: MailTemplate } | null {
  const previo = h.pasado.at(-1);
  if (!previo) return null;
  return {
    historial: {
      pasado: h.pasado.slice(0, -1),
      futuro: [presente, ...h.futuro].slice(0, LIMITE_DEL_HISTORIAL),
      grupo: null,
    },
    presente: previo,
  };
}

export function rehacer(h: HistorialCorreo, presente: MailTemplate): { historial: HistorialCorreo; presente: MailTemplate } | null {
  const siguiente = h.futuro[0];
  if (!siguiente) return null;
  return {
    historial: {
      pasado: [...h.pasado, presente].slice(-LIMITE_DEL_HISTORIAL),
      futuro: h.futuro.slice(1),
      grupo: null,
    },
    presente: siguiente,
  };
}

/** Corta el grupo de texto abierto: la próxima tecla abre una entrada nueva. */
export function cerrarGrupo(h: HistorialCorreo): HistorialCorreo {
  return h.grupo ? { ...h, grupo: null } : h;
}

type EventoDeAtajo = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

/** Cmd/Ctrl+Z deshace; Cmd/Ctrl+Shift+Z (o Ctrl+Y) rehace. */
export function atajoDeHistorial(event: EventoDeAtajo): "deshacer" | "rehacer" | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "rehacer" : "deshacer";
  if (key === "y" && event.ctrlKey && !event.metaKey) return "rehacer";
  return null;
}

/** ¿El atajo global debe ceder? En un input o textarea manda su propio deshacer. */
export function esCampoNativo(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === "string" ? el.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}
