import { create } from "zustand";

import type {
  MailExportPayload,
  MailPreset,
  MailPreview,
  MailProblem,
  MailRecipients,
  MailReview,
  MailTemplate,
  MailTemplatePayload,
  MailTemplatePutPayload,
} from "../../../api/materialMail";
import {
  CABECERA,
  SOBRE,
  huellaDeEdicion,
  type PropDeTexto,
  type VistaDelCorreo,
} from "./modeloCorreo";

// =============================================================================
// Store del editor de correos (ADR 0110 §2)
// =============================================================================
// El estado duro —la plantilla guardada, su revisión, los destinatarios— vive en
// el backend. Aquí está la copia de trabajo (el borrador que todavía no se
// guarda) y lo efímero de la vista: qué bloque está elegido, cómo se mira el
// correo, a quién se mira.
//
// **Los destinatarios sólo en memoria.** El resumen que llega no trae correos,
// y aun así este store no usa `persist`: nada de esto toca localStorage.

export type Ocupacion = "guardando" | "exportando" | "importando" | "subiendo" | "mapeando" | "olvidando";

export type Aviso = { tono: "ok" | "error" | "info"; texto: string };

/** Dónde cae un `{{campo}}` cuando se pulsa en la lista de campos. */
export type DestinoDelCampo = {
  objetivo: string;
  prop: PropDeTexto | "subject" | "preheader";
  cursor: number | null;
};

export type EstadoCorreos = {
  carga: "inicial" | "cargando" | "lista" | "error";
  errorCarga: string;
  presets: MailPreset[];
  guardada: MailTemplate | null;
  stateRevision: number | null;
  builtin: boolean;
  /** La plantilla guardada no cumple el contrato: hay que guardarla corregida. */
  problemasGuardados: MailProblem[];
  borrador: MailTemplate | null;
  destinatarios: MailRecipients | null;

  vistaPrevia: MailPreview | null;
  vistaPreviaCargando: boolean;
  vistaPreviaError: string;
  revision: MailReview | null;
  revisionCargando: boolean;
  problemas: MailProblem[];
  exportacion: MailExportPayload | null;
  ocupado: Ocupacion | null;
  aviso: Aviso | null;

  seleccion: string;
  vista: VistaDelCorreo;
  /** Posición (1..n) entre los destinatarios válidos; `null` = persona de ejemplo. */
  persona: number | null;
  destino: DestinoDelCampo | null;
  /** Imágenes subidas en esta sesión, para mostrarlas sin pedirlas otra vez. */
  imagenesLocales: Record<string, string>;
  /** Sube con cada imagen nueva: la vista previa la vuelve a pedir. */
  refresco: number;
  /** HTML de muestra de cada plantilla real, o `null` si no se pudo armar. */
  miniaturas: Record<string, string | null>;
};

type Acciones = {
  reiniciar: () => void;
  cargaInicio: () => void;
  cargaError: (mensaje: string) => void;
  cargaLista: (input: { presets: MailPreset[]; plantilla: MailTemplatePayload; destinatarios: MailRecipients }) => void;
  editar: (update: (t: MailTemplate) => MailTemplate) => void;
  reemplazarBorrador: (template: MailTemplate) => void;
  guardado: (payload: MailTemplatePutPayload) => void;
  seleccionar: (seleccion: string) => void;
  setVista: (vista: VistaDelCorreo) => void;
  setPersona: (persona: number | null) => void;
  siguientePersona: () => void;
  setDestino: (destino: DestinoDelCampo | null) => void;
  setDestinatarios: (destinatarios: MailRecipients) => void;
  vistaPreviaInicio: () => void;
  vistaPreviaLista: (preview: MailPreview) => void;
  vistaPreviaFallo: (mensaje: string, problemas?: MailProblem[]) => void;
  revisionInicio: () => void;
  revisionLista: (review: MailReview | null) => void;
  setProblemas: (problemas: MailProblem[]) => void;
  setOcupado: (ocupado: Ocupacion | null) => void;
  setAviso: (aviso: Aviso | null) => void;
  setExportacion: (exportacion: MailExportPayload | null) => void;
  recordarImagen: (id: string, url: string) => void;
  /** Pide de nuevo la vista previa (p. ej. tras reemplazar un archivo). */
  refrescar: () => void;
  setMiniatura: (presetId: string, html: string | null) => void;
};

const INICIAL: EstadoCorreos = {
  carga: "inicial",
  errorCarga: "",
  presets: [],
  guardada: null,
  stateRevision: null,
  builtin: true,
  problemasGuardados: [],
  borrador: null,
  destinatarios: null,
  vistaPrevia: null,
  vistaPreviaCargando: false,
  vistaPreviaError: "",
  revision: null,
  revisionCargando: false,
  problemas: [],
  exportacion: null,
  ocupado: null,
  aviso: null,
  seleccion: SOBRE,
  vista: "escritorio",
  persona: null,
  destino: null,
  imagenesLocales: {},
  refresco: 0,
  miniaturas: {},
};

/** La primera persona importada, o la de ejemplo si no hay lista. */
function revocar(url: string | undefined): void {
  if (url && url.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function personaInicial(destinatarios: MailRecipients | null): number | null {
  return destinatarios?.loaded && (destinatarios.counts?.valid ?? 0) > 0 ? 1 : null;
}

/** Un id elegido que sigue existiendo en la plantilla, o el sobre. */
function seleccionVigente(seleccion: string, template: MailTemplate | null): string {
  if (seleccion === SOBRE || seleccion === CABECERA) return seleccion;
  return template?.blocks.some((b) => b.block_id === seleccion) ? seleccion : SOBRE;
}

export const useCorreosStore = create<EstadoCorreos & Acciones>((set) => ({
  ...INICIAL,

  reiniciar: () => set((s) => {
    for (const url of Object.values(s.imagenesLocales)) revocar(url);
    return { ...INICIAL };
  }),

  cargaInicio: () => set({ carga: "cargando", errorCarga: "" }),
  cargaError: (mensaje) => set({ carga: "error", errorCarga: mensaje }),
  cargaLista: ({ presets, plantilla, destinatarios }) => set((s) => ({
    carga: "lista",
    errorCarga: "",
    presets,
    guardada: plantilla.template,
    stateRevision: plantilla.state_revision,
    builtin: plantilla.builtin,
    problemasGuardados: plantilla.stored_problems,
    borrador: plantilla.template,
    destinatarios,
    persona: personaInicial(destinatarios),
    // Los problemas de la guardada se pintan junto a su bloque desde el inicio.
    problemas: plantilla.stored_problems,
    exportacion: null,
    seleccion: seleccionVigente(s.seleccion, plantilla.template),
  })),

  editar: (update) => set((s) => (s.borrador
    ? { borrador: update(s.borrador), exportacion: null, aviso: null }
    : {})),

  reemplazarBorrador: (template) => set((s) => ({
    borrador: template,
    exportacion: null,
    aviso: null,
    problemas: [],
    seleccion: seleccionVigente(s.seleccion, template),
  })),

  guardado: (payload) => set((s) => {
    // Lo que se guardó es lo que el backend devolvió; si mientras tanto se
    // siguió editando, el borrador conserva esos cambios encima.
    const enviadoIgual = huellaDeEdicion(s.borrador) === huellaDeEdicion(payload.template);
    return {
      guardada: payload.template,
      stateRevision: payload.state_revision,
      builtin: false,
      problemasGuardados: [],
      borrador: enviadoIgual || !s.borrador
        ? payload.template
        : { ...s.borrador, revision: payload.template.revision, template_sha256: payload.template.template_sha256 },
      problemas: [],
    };
  }),

  seleccionar: (seleccion) => set({ seleccion }),
  setVista: (vista) => set({ vista }),
  setPersona: (persona) => set({ persona }),
  siguientePersona: () => set((s) => {
    const total = s.destinatarios?.counts?.valid ?? 0;
    if (!total) return {};
    return { persona: s.persona === null ? 1 : (s.persona % total) + 1 };
  }),
  setDestino: (destino) => set({ destino }),
  setDestinatarios: (destinatarios) => set((s) => {
    const total = destinatarios.counts?.valid ?? 0;
    const persona = destinatarios.loaded && total
      ? (s.persona !== null && s.persona <= total ? s.persona : 1)
      : null;
    return { destinatarios, persona, exportacion: null };
  }),

  vistaPreviaInicio: () => set({ vistaPreviaCargando: true }),
  vistaPreviaLista: (vistaPrevia) => set({ vistaPrevia, vistaPreviaCargando: false, vistaPreviaError: "", problemas: [] }),
  vistaPreviaFallo: (mensaje, problemas) => set((s) => ({
    vistaPreviaCargando: false,
    vistaPreviaError: mensaje,
    problemas: problemas ?? s.problemas,
  })),
  revisionInicio: () => set({ revisionCargando: true }),
  revisionLista: (revision) => set((s) => ({ revision: revision ?? s.revision, revisionCargando: false })),
  setProblemas: (problemas) => set({ problemas }),
  setOcupado: (ocupado) => set({ ocupado }),
  setAviso: (aviso) => set({ aviso }),
  setExportacion: (exportacion) => set({ exportacion }),
  recordarImagen: (id, url) => set((s) => {
    const previa = s.imagenesLocales[id];
    if (previa !== url) revocar(previa);
    return { imagenesLocales: { ...s.imagenesLocales, [id]: url }, refresco: s.refresco + 1 };
  }),
  refrescar: () => set((s) => ({ refresco: s.refresco + 1 })),
  setMiniatura: (presetId, html) => set((s) => ({ miniaturas: { ...s.miniaturas, [presetId]: html } })),
}));

/** ¿El borrador difiere de lo guardado? */
export function hayCambios(s: Pick<EstadoCorreos, "borrador" | "guardada">): boolean {
  if (!s.borrador) return false;
  return huellaDeEdicion(s.borrador) !== huellaDeEdicion(s.guardada);
}

/**
 * ¿Hay que guardar? Hay cambios, o lo guardado es inválido y debe
 * reemplazarse aunque el borrador sea idéntico (el backend lo revalida).
 */
export function hayQueGuardar(s: Pick<EstadoCorreos, "borrador" | "guardada" | "problemasGuardados">): boolean {
  return Boolean(s.borrador) && (hayCambios(s) || s.problemasGuardados.length > 0);
}
