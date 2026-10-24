import { create } from "zustand";

import {
  MAIL_PLATFORM_DEFAULT,
  mailSendInvitation,
  type MailCampaignSummary,
  type MailExportPayload,
  type MailImageReduccion,
  type MailPlatform,
  type MailPreset,
  type MailPreview,
  type MailProblem,
  type MailRecipients,
  type MailReview,
  type MailSend,
  type MailTemplate,
  type MailTemplatePayload,
  type MailTemplatePutPayload,
} from "../../../api/materialMail";
import {
  CABECERA,
  SOBRE,
  huellaDeEdicion,
  type PropDeTexto,
  type VistaDelCorreo,
} from "./modeloCorreo";
import type { VistaDelBloque } from "./EstiloDelBloque";
import { revisionEncadenada } from "./modeloCampanas";
import { enviosCambiados, envioRecordado, envioVigente, reconciliarEnvios, recordarEnvio } from "./modeloEnvios";
import {
  HISTORIAL_VACIO,
  cerrarGrupo,
  deshacer as deshacerEnHistorial,
  registrarCambio,
  rehacer as rehacerEnHistorial,
  type HistorialCorreo,
} from "./historialCorreo";

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

export type Ocupacion = "campanas" | "guardando" | "exportando" | "exportando-plantilla" | "importando" | "subiendo" | "mapeando" | "olvidando";

export type Aviso = { tono: "ok" | "error" | "info"; texto: string };

/** Dónde cae un `{{campo}}` cuando se pulsa en la lista de campos. */
export type DestinoDelCampo = {
  objetivo: string;
  prop: PropDeTexto | "subject" | "preheader";
  cursor: number | null;
};

/** El texto que se edita en el sitio, sobre el correo (E1g). */
export type EdicionEnLinea = { zona: string; prop: string };

const CLAVE_EXPLICACIONES = "pulso.correos.explicaciones";

/** «Explicaciones» se recuerda en este equipo; no es un dato del proyecto ni personal. */
function explicacionesGuardadas(): boolean {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(CLAVE_EXPLICACIONES) !== "0";
  } catch {
    return true;
  }
}

function guardarExplicaciones(valor: boolean): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CLAVE_EXPLICACIONES, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado): el interruptor vale para esta sesión.
  }
}

export type EstadoCorreos = {
  /** Campañas del proyecto (E1h): el resumen, sin la plantilla completa. */
  campanasCarga: "inicial" | "cargando" | "lista" | "error";
  campanasError: string;
  campanas: MailCampaignSummary[];
  /** La campaña cuya plantilla está cargada; la elige el `foco`. */
  campana: string | null;
  /** Aviso de una escritura de campañas: sobrevive al cambio de campaña. */
  avisoCampanas: Aviso | null;
  /** Qué campaña pide borrar el diálogo; sin pedido, la del foco. */
  borrarPedido: { campaignId: string; desdeDialogo: boolean } | null;

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
  /** Plataforma de la campaña abierta (E1j): decide el dialecto de todo lo que se muestra. */
  plataforma: MailPlatform;
  /** Envíos de la campaña (E1k): lo guardado y la copia de trabajo, que se guardan con la plantilla. */
  enviosGuardados: MailSend[];
  envios: MailSend[];
  /** El envío que se mira; se recuerda por campaña en sessionStorage. */
  envio: string;
  /** La plantilla del borrador salió de un HTML importado: el próximo guardado lo cita. */
  importPendiente: string | null;
  /** Imagen cuyo texto alternativo hay que pedir (llegó vacío al importar). Sobrevive al cambio de campaña. */
  pedirAlt: string | null;

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
  /** «Contenido | Estilo» del inspector del bloque elegido; la barra del lienzo abre «Estilo» (L10). */
  vistaDelBloque: VistaDelBloque;
  vista: VistaDelCorreo;
  /** Posición (1..n) entre los destinatarios válidos; `null` = persona de ejemplo. */
  persona: number | null;
  destino: DestinoDelCampo | null;
  /** Imágenes subidas en esta sesión, para mostrarlas sin pedirlas otra vez. */
  imagenesLocales: Record<string, string>;
  /** Imágenes que el backend redujo al subirlas en esta sesión, por id: la vista lo dice junto a cada una. */
  reducciones: Record<string, MailImageReduccion>;
  /** Sube con cada imagen nueva: la vista previa la vuelve a pedir. */
  refresco: number;
  /** HTML de muestra de cada plantilla real, o `null` si no se pudo armar. */
  miniaturas: Record<string, string | null>;
  /** Deshacer y rehacer del borrador, por campaña (historialCorreo.ts). */
  historial: HistorialCorreo;
  edicion: EdicionEnLinea | null;
  /** Modo didáctico: rótulos al pasar el cursor y la tarjeta «Qué hace». */
  explicaciones: boolean;
  /** En compacto, la columna de plantillas y bloques vive en un cajón: ¿está abierto? (F3) */
  cajonAbierto: boolean;
  /** «Exportar ▾» de la barra, abierto (F7). */
  exportarAbierto: boolean;
};

type Acciones = {
  reiniciar: () => void;
  /**
   * Cambio de campaña: se olvida todo lo de la anterior (borrador, historial
   * de selección, destinatarios, vista previa, revisión, export) y se
   * conservan la lista de campañas, los presets, la revisión y cómo se mira.
   */
  reiniciarCampana: (campana: string | null) => void;
  campanasInicio: () => void;
  campanasFallo: (mensaje: string) => void;
  campanasLista: (campanas: MailCampaignSummary[], stateRevision: number) => void;
  setCampanas: (update: (campanas: MailCampaignSummary[]) => MailCampaignSummary[]) => void;
  setPresets: (presets: MailPreset[]) => void;
  setAvisoCampanas: (aviso: Aviso | null) => void;
  setBorrarPedido: (pedido: EstadoCorreos["borrarPedido"]) => void;
  /** Toda escritura devuelve la revisión nueva: la siguiente la usa (nunca baja). */
  anotarRevision: (stateRevision: number | null | undefined) => void;
  cargaInicio: () => void;
  cargaError: (mensaje: string) => void;
  cargaLista: (input: { presets: MailPreset[]; plantilla: MailTemplatePayload; destinatarios: MailRecipients }) => void;
  /**
   * Cambia el borrador. Con `grupo` (`bloque.prop`) el cambio es de texto y se
   * agrupa en el historial con los siguientes del mismo texto; sin él es de
   * estructura y entra solo.
   */
  editar: (update: (t: MailTemplate) => MailTemplate, grupo?: string) => void;
  deshacer: () => void;
  rehacer: () => void;
  /** La próxima edición de texto abre su propia entrada. */
  cortarGrupo: () => void;
  setEdicion: (edicion: EdicionEnLinea | null) => void;
  setExplicaciones: (valor: boolean) => void;
  reemplazarBorrador: (template: MailTemplate) => void;
  /** `enviados`: los envíos tal como se mandaron, para alinear los ids nuevos. */
  /**
   * `enviada`: la plantilla tal como se mandó. Si el borrador no cambió desde
   * entonces, se adopta lo que devolvió el backend (que la normaliza) y el
   * correo queda guardado; sin ella se compara con lo devuelto.
   */
  guardado: (payload: MailTemplatePutPayload, enviados?: readonly MailSend[], enviada?: MailTemplate | null) => void;
  setEnvio: (sendId: string) => void;
  /** Cambia los envíos del borrador; no entran al historial de la plantilla. */
  editarEnvios: (update: (envios: MailSend[]) => MailSend[]) => void;
  /** Reemplaza la plantilla por la de un HTML importado (entra al historial). */
  reemplazarPorImportada: (template: MailTemplate, importId: string) => void;
  setPlataforma: (plataforma: MailPlatform) => void;
  setPedirAlt: (id: string | null) => void;
  seleccionar: (seleccion: string) => void;
  setVistaDelBloque: (vista: VistaDelBloque) => void;
  setVista: (vista: VistaDelCorreo) => void;
  setCajonAbierto: (abierto: boolean) => void;
  setExportarAbierto: (abierto: boolean) => void;
  setPersona: (persona: number | null) => void;
  siguientePersona: () => void;
  setDestino: (destino: DestinoDelCampo | null) => void;
  setDestinatarios: (destinatarios: MailRecipients) => void;
  vistaPreviaInicio: () => void;
  vistaPreviaLista: (preview: MailPreview) => void;
  vistaPreviaFallo: (mensaje: string, problemas?: MailProblem[]) => void;
  /** No se pidió la vista previa (un campo no declarado): queda la última buena, sin error del servidor. */
  vistaPreviaRetenida: () => void;
  revisionInicio: () => void;
  revisionLista: (review: MailReview | null) => void;
  setProblemas: (problemas: MailProblem[]) => void;
  setOcupado: (ocupado: Ocupacion | null) => void;
  setAviso: (aviso: Aviso | null) => void;
  setExportacion: (exportacion: MailExportPayload | null) => void;
  recordarImagen: (id: string, url: string) => void;
  /** Lo que el backend hizo con la imagen recién subida; `null` (no se redujo) olvida la anterior. */
  recordarReduccion: (id: string, reduccion: MailImageReduccion | null) => void;
  /** Pide de nuevo la vista previa (p. ej. tras reemplazar un archivo). */
  refrescar: () => void;
  setMiniatura: (presetId: string, html: string | null) => void;
};

const INICIAL: EstadoCorreos = {
  campanasCarga: "inicial",
  campanasError: "",
  campanas: [],
  campana: null,
  avisoCampanas: null,
  borrarPedido: null,
  carga: "inicial",
  errorCarga: "",
  presets: [],
  guardada: null,
  stateRevision: null,
  builtin: true,
  problemasGuardados: [],
  borrador: null,
  destinatarios: null,
  plataforma: MAIL_PLATFORM_DEFAULT,
  enviosGuardados: [mailSendInvitation()],
  envios: [mailSendInvitation()],
  envio: "invitacion",
  importPendiente: null,
  pedirAlt: null,
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
  vistaDelBloque: "contenido",
  vista: "escritorio",
  persona: null,
  destino: null,
  imagenesLocales: {},
  reducciones: {},
  refresco: 0,
  miniaturas: {},
  historial: HISTORIAL_VACIO,
  edicion: null,
  explicaciones: true,
  cajonAbierto: false,
  exportarAbierto: false,
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

/** Lo que se restaura al deshacer: la plantilla anterior con la revisión de hoy. */
function conRevisionVigente(template: MailTemplate, vigente: MailTemplate): MailTemplate {
  return { ...template, revision: vigente.revision, template_sha256: vigente.template_sha256 };
}

export const useCorreosStore = create<EstadoCorreos & Acciones>((set) => ({
  ...INICIAL,
  explicaciones: explicacionesGuardadas(),

  reiniciar: () => set((s) => {
    for (const url of Object.values(s.imagenesLocales)) revocar(url);
    return { ...INICIAL, explicaciones: s.explicaciones };
  }),

  reiniciarCampana: (campana) => set((s) => {
    for (const url of Object.values(s.imagenesLocales)) revocar(url);
    return {
      ...INICIAL,
      campanasCarga: s.campanasCarga,
      campanasError: s.campanasError,
      campanas: s.campanas,
      campana,
      avisoCampanas: s.avisoCampanas,
      borrarPedido: s.borrarPedido,
      presets: s.presets,
      miniaturas: s.miniaturas,
      stateRevision: s.stateRevision,
      vista: s.vista,
      explicaciones: s.explicaciones,
      pedirAlt: s.pedirAlt,
    };
  }),
  campanasInicio: () => set({ campanasCarga: "cargando", campanasError: "" }),
  campanasFallo: (mensaje) => set({ campanasCarga: "error", campanasError: mensaje }),
  campanasLista: (campanas, stateRevision) => set((s) => ({
    campanasCarga: "lista",
    campanasError: "",
    campanas,
    stateRevision: revisionEncadenada(s.stateRevision, stateRevision),
  })),
  setCampanas: (update) => set((s) => ({ campanas: update(s.campanas) })),
  setPresets: (presets) => set({ presets }),
  setAvisoCampanas: (avisoCampanas) => set({ avisoCampanas }),
  setBorrarPedido: (borrarPedido) => set({ borrarPedido }),
  anotarRevision: (stateRevision) => set((s) => ({ stateRevision: revisionEncadenada(s.stateRevision, stateRevision) })),

  cargaInicio: () => set({ carga: "cargando", errorCarga: "" }),
  cargaError: (mensaje) => set({ carga: "error", errorCarga: mensaje }),
  cargaLista: ({ presets, plantilla, destinatarios }) => set((s) => ({
    plataforma: plantilla.platform,
    enviosGuardados: plantilla.sends,
    envios: plantilla.sends,
    envio: envioVigente(plantilla.sends, s.campana ? envioRecordado(s.campana) : null).send_id,
    importPendiente: null,
    carga: "lista",
    errorCarga: "",
    presets: presets.length ? presets : s.presets,
    guardada: plantilla.template,
    stateRevision: revisionEncadenada(s.stateRevision, plantilla.state_revision),
    builtin: plantilla.builtin,
    problemasGuardados: plantilla.stored_problems,
    borrador: plantilla.template,
    destinatarios,
    persona: personaInicial(destinatarios),
    // Los problemas de la guardada se pintan junto a su bloque desde el inicio.
    problemas: plantilla.stored_problems,
    exportacion: null,
    seleccion: seleccionVigente(s.seleccion, plantilla.template),
    historial: HISTORIAL_VACIO,
    edicion: null,
  })),

  editar: (update, grupo) => set((s) => {
    if (!s.borrador) return {};
    const siguiente = update(s.borrador);
    if (siguiente === s.borrador) return {};
    const antes = huellaDeEdicion(s.borrador);
    const despues = huellaDeEdicion(siguiente);
    if (antes === despues) return {};
    return {
      borrador: siguiente,
      // N6: la huella dice qué se escribió; el historial agrupa por palabra.
      historial: registrarCambio(s.historial, s.borrador, grupo ? { texto: grupo, ahora: Date.now(), antes, despues } : null),
      exportacion: null,
      aviso: null,
    };
  }),

  deshacer: () => set((s) => {
    if (!s.borrador) return {};
    const out = deshacerEnHistorial(s.historial, s.borrador);
    if (!out) return {};
    const borrador = conRevisionVigente(out.presente, s.borrador);
    return { borrador, historial: out.historial, exportacion: null, aviso: null, seleccion: seleccionVigente(s.seleccion, borrador) };
  }),

  rehacer: () => set((s) => {
    if (!s.borrador) return {};
    const out = rehacerEnHistorial(s.historial, s.borrador);
    if (!out) return {};
    const borrador = conRevisionVigente(out.presente, s.borrador);
    return { borrador, historial: out.historial, exportacion: null, aviso: null, seleccion: seleccionVigente(s.seleccion, borrador) };
  }),

  cortarGrupo: () => set((s) => ({ historial: cerrarGrupo(s.historial) })),
  setEdicion: (edicion) => set({ edicion }),
  setExplicaciones: (explicaciones) => {
    guardarExplicaciones(explicaciones);
    set({ explicaciones });
  },

  reemplazarBorrador: (template) => set((s) => ({
    borrador: template,
    historial: s.borrador ? registrarCambio(s.historial, s.borrador, null) : s.historial,
    exportacion: null,
    aviso: null,
    problemas: [],
    seleccion: seleccionVigente(s.seleccion, template),
  })),

  guardado: (payload, enviados, enviada) => set((s) => {
    // Lo que se guardó es lo que el backend devolvió; si mientras tanto se
    // siguió editando, el borrador conserva esos cambios encima. «Mientras
    // tanto» se mide contra lo que se mandó: el backend completa valores por
    // defecto y, comparado con lo devuelto, el correo quedaba «sin guardar» (F6).
    const enviadoIgual = huellaDeEdicion(s.borrador) === huellaDeEdicion(enviada ?? payload.template);
    // Los envíos: lo que devolvió el servidor, con los ids nuevos en lugar de
    // los locales. Si se siguieron editando mientras tanto, esa edición queda.
    const { envios: vueltos, ids } = reconciliarEnvios(enviados ?? s.envios, payload.sends);
    const enviosIguales = !enviados || !enviosCambiados(enviados, s.envios);
    const renombrar = (e: MailSend) => (ids[e.send_id] ? { ...e, send_id: ids[e.send_id] } : e);
    const envio = ids[s.envio] ?? s.envio;
    if (s.campana) recordarEnvio(s.campana, envio);
    return {
      enviosGuardados: vueltos,
      envios: enviosIguales ? vueltos : s.envios.map(renombrar),
      envio,
      importPendiente: null,
      guardada: payload.template,
      stateRevision: revisionEncadenada(s.stateRevision, payload.state_revision),
      builtin: false,
      problemasGuardados: [],
      borrador: enviadoIgual || !s.borrador
        ? payload.template
        : { ...s.borrador, revision: payload.template.revision, template_sha256: payload.template.template_sha256 },
      problemas: [],
    };
  }),

  setEnvio: (envio) => set((s) => {
    if (envio === s.envio || !s.envios.some((e) => e.send_id === envio)) return {};
    if (s.campana) recordarEnvio(s.campana, envio);
    return { envio, exportacion: null, edicion: null };
  }),
  editarEnvios: (update) => set((s) => {
    const envios = update(s.envios);
    if (!enviosCambiados(envios, s.envios)) return {};
    // Si el envío elegido se quitó, se vuelve a la invitación.
    const envio = envios.some((e) => e.send_id === s.envio) ? s.envio : envios[0]?.send_id ?? "invitacion";
    return { envios, envio, exportacion: null, aviso: null };
  }),
  reemplazarPorImportada: (template, importId) => set((s) => ({
    borrador: { ...template, revision: s.borrador?.revision ?? template.revision, template_sha256: s.borrador?.template_sha256 },
    historial: s.borrador ? registrarCambio(s.historial, s.borrador, null) : s.historial,
    importPendiente: importId,
    exportacion: null,
    aviso: null,
    problemas: [],
    seleccion: SOBRE,
    edicion: null,
  })),
  setPedirAlt: (pedirAlt) => set({ pedirAlt }),
  setPlataforma: (plataforma) => set((s) => (s.plataforma === plataforma ? {} : { plataforma, exportacion: null, refresco: s.refresco + 1 })),

  // Otro bloque abre en su contenido; volver a elegir el mismo no cambia la vista.
  seleccionar: (seleccion) => set((s) => (s.seleccion === seleccion ? { seleccion } : { seleccion, vistaDelBloque: "contenido" })),
  setVistaDelBloque: (vistaDelBloque) => set({ vistaDelBloque }),
  setVista: (vista) => set({ vista }),
  setCajonAbierto: (cajonAbierto) => set({ cajonAbierto }),
  setExportarAbierto: (exportarAbierto) => set({ exportarAbierto }),
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
  vistaPreviaRetenida: () => set({ vistaPreviaCargando: false, vistaPreviaError: "" }),
  setProblemas: (problemas) => set({ problemas }),
  setOcupado: (ocupado) => set({ ocupado }),
  setAviso: (aviso) => set({ aviso }),
  setExportacion: (exportacion) => set({ exportacion }),
  recordarImagen: (id, url) => set((s) => {
    const previa = s.imagenesLocales[id];
    if (previa !== url) revocar(previa);
    return { imagenesLocales: { ...s.imagenesLocales, [id]: url }, refresco: s.refresco + 1 };
  }),
  recordarReduccion: (id, reduccion) => set((s) => {
    if (reduccion?.reducida) return { reducciones: { ...s.reducciones, [id]: reduccion } };
    if (!(id in s.reducciones)) return {};
    const { [id]: _olvidada, ...resto } = s.reducciones;
    void _olvidada;
    return { reducciones: resto };
  }),
  refrescar: () => set((s) => ({ refresco: s.refresco + 1 })),
  setMiniatura: (presetId, html) => set((s) => ({ miniaturas: { ...s.miniaturas, [presetId]: html } })),
}));

type EstadoDeEnvios = Partial<Pick<EstadoCorreos, "envios" | "enviosGuardados">>;

/** ¿El borrador (plantilla o envíos) difiere de lo guardado? */
export function hayCambios(s: Pick<EstadoCorreos, "borrador" | "guardada"> & EstadoDeEnvios): boolean {
  if (!s.borrador) return false;
  return huellaDeEdicion(s.borrador) !== huellaDeEdicion(s.guardada)
    || (s.envios !== undefined && enviosCambiados(s.envios, s.enviosGuardados));
}

/**
 * ¿Hay que guardar? Hay cambios, o lo guardado es inválido y debe
 * reemplazarse aunque el borrador sea idéntico (el backend lo revalida).
 */
export function hayQueGuardar(s: Pick<EstadoCorreos, "borrador" | "guardada" | "problemasGuardados"> & EstadoDeEnvios): boolean {
  return Boolean(s.borrador) && (hayCambios(s) || s.problemasGuardados.length > 0);
}

/** Por qué el proyecto puede decir «sin guardar» aunque el correo esté guardado (F6). */
export const NOTA_DEL_PROYECTO =
  "El correo está guardado en la campaña. El proyecto .pulso se guarda aparte, desde su nombre arriba a la derecha.";

/** El envío que se mira, completo. */
export function envioElegido(s: Pick<EstadoCorreos, "envios" | "envio">): MailSend {
  return envioVigente(s.envios, s.envio);
}
