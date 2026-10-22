import { useCallback, useEffect, useRef } from "react";

import { apiSaveEntregable } from "../../../api/workspace";
import {
  MailApiError,
  apiMailExport,
  apiMailImageUpload,
  apiMailPresets,
  apiMailPreview,
  apiMailRecipients,
  apiMailRecipientsDelete,
  apiMailRecipientsImport,
  apiMailRecipientsMapping,
  apiMailReview,
  apiMailTemplate,
  apiMailTemplatePut,
  type MailExportScope,
  type MailRecipientsMapping,
  type MailTemplate,
} from "../../../api/materialMail";
import { camposNoDeclarados } from "./camposDeclarados";
import { conDestinatarios, conPlantillaGuardada } from "./modeloCampanas";
import { huellaDeEdicion } from "./modeloCorreo";
import { enviosParaGuardar, huellaDeEnvios, rotuloDeEnvio } from "./modeloEnvios";
import { NOTA_DEL_PROYECTO, envioElegido, hayCambios, hayQueGuardar, useCorreosStore, type EstadoCorreos } from "./store";

const GUARDADA_INVALIDA = "E_COLLECTION_MAIL_TEMPLATE_STORED_INVALID";

/** Exportar exige la revisión que la vista leyó; sin ella no se sabe qué se exporta. */
export const AVISO_SIN_REVISION = "No se sabe qué versión del correo está guardada. Vuelve a cargar el correo antes de exportar.";

/** Textos propios para los rechazos del import que la persona sí puede corregir. */
const AVISO_DE_IMPORTACION: Record<string, string> = {
  E_COLLECTION_MAIL_PLATFORM: "Esta campaña sale por SurveyMonkey: los contactos se cargan en su recopilador, no aquí.",
  E_COLLECTION_MAIL_RECIPIENTS_NO_HEADER: "La primera fila parece un destinatario; agrega una fila de encabezados.",
  E_COLLECTION_MAIL_RECIPIENTS_ENCODING: "No se reconoce la codificación del archivo. Guárdalo como «CSV UTF-8» o como XLSX.",
};

/** Por qué no se aceptó una imagen (`details.reason` de E_COLLECTION_MAIL_IMAGE_INVALID). */
const AVISO_DE_IMAGEN: Record<string, string> = {
  format: "La imagen tiene que ser PNG o JPEG.",
  too_large: "La imagen pesa más de 1 MB: redúcela antes de subirla.",
  unreadable: "No se pudo leer la imagen: vuelve a exportarla como PNG o JPEG.",
  width: "La imagen tiene que medir entre 40 y 1.200 px de ancho.",
  name: "El nombre de la imagen no sirve como archivo para Mailchimp: usa letras, números y guiones.",
};

/** El aviso de una subida de imagen rechazada, con el motivo en la voz de la vista. */
export function avisoDeImagen(cause: unknown): string {
  if (cause instanceof MailApiError && cause.code === "E_COLLECTION_MAIL_IMAGE_INVALID") {
    return AVISO_DE_IMAGEN[cause.reason] ?? "La imagen no cumple lo que pide el correo (PNG o JPEG, hasta 1 MB, de 40 a 1.200 px).";
  }
  return mensajeDe(cause, "No se pudo subir la imagen.");
}

/** El aviso de un import rechazado; el motivo interno nunca llega a la vista. */
export function avisoDeImportacion(cause: unknown): string {
  if (cause instanceof MailApiError && AVISO_DE_IMPORTACION[cause.code]) return AVISO_DE_IMPORTACION[cause.code];
  return mensajeDe(cause, "No se pudo leer la lista de destinatarios.");
}
const AVISO_GUARDADA_INVALIDA = "La plantilla guardada en el proyecto no es válida. Corrige lo marcado y guarda el correo para reemplazarla.";

function mensajeDe(cause: unknown, fallback: string): string {
  if (cause instanceof MailApiError && cause.code === GUARDADA_INVALIDA) return AVISO_GUARDADA_INVALIDA;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * El pedido del HTML que se pega en la plataforma: `mode: "export"` (las
 * etiquetas reales del dialecto de la campaña), sobre el borrador y con el
 * envío que se mira. Nunca la vista previa, que resuelve los campos.
 */
const CLAVE_NOTA_DEL_PROYECTO = "pulso.correos.nota-del-proyecto";

/** La nota del .pulso se dice una vez por sesión del navegador, no en cada guardado. */
function primeraVezQueSeGuarda(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return true;
    if (sessionStorage.getItem(CLAVE_NOTA_DEL_PROYECTO)) return false;
    sessionStorage.setItem(CLAVE_NOTA_DEL_PROYECTO, "1");
    return true;
  } catch {
    return true;
  }
}

export function pedidoDelHtmlDeLaPlataforma(
  st: Pick<EstadoCorreos, "borrador" | "campana" | "envios" | "envio">,
): Parameters<typeof apiMailPreview>[0] | null {
  if (!st.borrador || !st.campana) return null;
  return { mode: "export", template: st.borrador, campaign_id: st.campana, envio: { send: envioElegido(st) } };
}

const ESPERA_VISTA_MS = 280;

/** `blob:` para mostrar el PNG recién subido; `null` donde no hay `URL.createObjectURL`. */
function urlLocalDe(file: File): string | null {
  return typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}
const ESPERA_REVISION_MS = 650;

/**
 * Carga, vista previa, revisión y acciones del editor de correos.
 *
 * La vista previa y la revisión se piden sobre el BORRADOR (el backend acepta
 * una plantilla sin guardar), con una espera corta para no llamar en cada
 * tecla. Exportar trabaja sobre la plantilla GUARDADA: si hay cambios, se
 * guardan antes.
 *
 * Todo trabaja sobre la campaña del store (`campana`, la que elige el foco):
 * cada llamada lleva su `campaign_id`. Cambiar de campaña lo hace quien la
 * elige (`reiniciarCampana`); aquí sólo se vuelve a cargar.
 *
 * `onEscrito` avisa al shell de cada escritura del estado (guardar): su
 * revisión quedó vieja y otras secciones darían 409 (H-f).
 */
export function useCorreos(opciones: { onEscrito?: () => void } = {}) {
  const s = useCorreosStore;
  const campana = useCorreosStore((st) => st.campana);
  const onEscrito = useRef(opciones.onEscrito);
  onEscrito.current = opciones.onEscrito;
  const borrador = useCorreosStore((st) => st.borrador);
  const persona = useCorreosStore((st) => st.persona);
  const carga = useCorreosStore((st) => st.carga);
  const destinatariosHuella = useCorreosStore((st) => (st.destinatarios
    ? `${st.destinatarios.imported_at ?? ""}|${JSON.stringify(st.destinatarios.mapping)}`
    : ""));
  const refresco = useCorreosStore((st) => st.refresco);
  // El envío que se mira entra a la vista previa y a la revisión como borrador:
  // su asunto o su apertura se ven antes de guardar.
  const huellaDelEnvio = useCorreosStore((st) => huellaDeEnvios([envioElegido(st)]));
  const plataforma = useCorreosStore((st) => st.plataforma);
  const huella = huellaDeEdicion(borrador);
  const turnoVista = useRef(0);
  const turnoRevision = useRef(0);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  /** ¿La respuesta es todavía de la campaña que se mira? */
  const vigente = useCallback((id: string) => vivo.current && s.getState().campana === id, [s]);

  const cargar = useCallback(async () => {
    const id = s.getState().campana;
    if (!id) return;
    s.getState().cargaInicio();
    try {
      const conocidos = s.getState().presets;
      const [presets, plantilla, destinatarios] = await Promise.all([
        conocidos.length ? Promise.resolve(null) : apiMailPresets(),
        apiMailTemplate(id),
        apiMailRecipients(id),
      ]);
      if (!vigente(id)) return;
      s.getState().cargaLista({ presets: presets?.presets ?? conocidos, plantilla, destinatarios });
      s.getState().setCampanas((lista) => conDestinatarios(lista, id, destinatarios.loaded));
      if (plantilla.stored_problems.length) s.getState().setAviso({ tono: "error", texto: AVISO_GUARDADA_INVALIDA });
    } catch (cause) {
      if (vigente(id)) s.getState().cargaError(mensajeDe(cause, "No se pudo leer el correo."));
    }
  }, [s, vigente]);

  // Cada campaña se carga al elegirla; el store ya olvidó la anterior.
  useEffect(() => {
    if (campana) void cargar();
  }, [campana, cargar]);

  // Vista previa del borrador, para la persona elegida.
  useEffect(() => {
    if (carga !== "lista") return;
    const template = s.getState().borrador;
    if (!template) return;
    const turno = ++turnoVista.current;
    // N5: con un campo que la campaña no declara el backend responde 422; la
    // vista se queda con la última buena y el lienzo lo dice.
    if (camposNoDeclarados(template, envioElegido(s.getState())).length) {
      s.getState().vistaPreviaRetenida();
      return;
    }
    const timer = window.setTimeout(() => {
      s.getState().vistaPreviaInicio();
      const envio = envioElegido(s.getState());
      apiMailPreview({ mode: "preview", recipient_index: persona, template, campaign_id: s.getState().campana, envio: { send: envio } }).then(
        (preview) => { if (vivo.current && turno === turnoVista.current) s.getState().vistaPreviaLista(preview); },
        (cause: unknown) => {
          if (!vivo.current || turno !== turnoVista.current) return;
          if (cause instanceof MailApiError && cause.code === "E_COLLECTION_MAIL_RECIPIENT_INDEX") {
            s.getState().setPersona(null);
            return;
          }
          const problemas = cause instanceof MailApiError && cause.problems.length ? cause.problems : undefined;
          s.getState().vistaPreviaFallo(mensajeDe(cause, "No se pudo armar la vista previa."), problemas);
        },
      );
    }, ESPERA_VISTA_MS);
    return () => window.clearTimeout(timer);
  }, [campana, carga, huella, huellaDelEnvio, persona, plataforma, refresco, s]);

  // Revisión del borrador: también depende de la lista de destinatarios.
  const revisar = useCallback(async (template: MailTemplate | null) => {
    const turno = ++turnoRevision.current;
    s.getState().revisionInicio();
    try {
      const st = s.getState();
      const review = await apiMailReview({ template, campaign_id: st.campana, envio: { send: envioElegido(st) } });
      if (vivo.current && turno === turnoRevision.current) s.getState().revisionLista(review);
    } catch (cause) {
      // Un borrador inválido no se puede revisar: sus problemas ya los pinta la
      // vista previa junto a cada bloque. La revisión anterior queda a la vista.
      if (vivo.current && turno === turnoRevision.current) s.getState().revisionLista(null);
      if (!(cause instanceof MailApiError && cause.problems.length) && vivo.current) {
        s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo revisar el correo.") });
      }
    }
  }, [s]);

  useEffect(() => {
    if (carga !== "lista") return;
    const template = s.getState().borrador;
    if (!template) return;
    // La revisión tampoco se pide con un campo no declarado: queda la anterior.
    if (camposNoDeclarados(template, envioElegido(s.getState())).length) return;
    const timer = window.setTimeout(() => { void revisar(template); }, ESPERA_REVISION_MS);
    return () => window.clearTimeout(timer);
  }, [campana, carga, huella, huellaDelEnvio, plataforma, destinatariosHuella, refresco, revisar, s]);

  /** Guarda el borrador. Devuelve `false` si no se pudo. */
  const guardar = useCallback(async (): Promise<boolean> => {
    const st = s.getState();
    const id = st.campana;
    if (!id || !st.borrador || st.stateRevision === null) return false;
    if (!hayQueGuardar(st) && !st.builtin) return true;
    st.setOcupado("guardando");
    st.setAviso(null);
    // Plantilla y envíos viajan juntos: una sola subida de revisión (E1k).
    const enviados = st.envios;
    const enviada = st.borrador;
    const plantillaCambio = huellaDeEdicion(st.borrador) !== huellaDeEdicion(st.guardada);
    try {
      const payload = await apiMailTemplatePut({
        template: st.borrador,
        expected_revision: st.stateRevision,
        campaign_id: id,
        sends: enviosParaGuardar(enviados),
        import_id: plantillaCambio ? st.importPendiente : null,
      });
      // La revisión nueva vale para todo el estado, aunque ya se mire otra campaña.
      s.getState().anotarRevision(payload.state_revision);
      if (!payload.noop) onEscrito.current?.();
      if (!vigente(id)) return true;
      s.getState().guardado(payload, enviados, enviada);
      s.getState().setCampanas((lista) => conPlantillaGuardada(lista, id, payload.template, payload.sends));
      const fechas = payload.send_warnings.map((w) => w.detail).join(" ");
      // F6: el estado lo dice la barra («Guardado»); aquí sólo lo que la barra no
      // dice: un aviso de fechas, o —la primera vez— por qué el proyecto sigue
      // «sin guardar» (el .pulso se guarda aparte).
      s.getState().setAviso(fechas
        ? { tono: "info", texto: fechas }
        : !payload.noop && primeraVezQueSeGuarda()
          ? { tono: "info", texto: NOTA_DEL_PROYECTO }
          : null);
      return true;
    } catch (cause) {
      if (!vivo.current) return false;
      if (cause instanceof MailApiError && cause.code === "E_COLLECTION_MAIL_SEND_INVALID") {
        const detalle = cause.problems.map((p) => p.detail).filter(Boolean).join(" ");
        s.getState().setAviso({ tono: "error", texto: `Hay envíos por corregir antes de guardar.${detalle ? ` ${detalle}` : ""}` });
      } else if (cause instanceof MailApiError && cause.problems.length) {
        s.getState().setProblemas(cause.problems);
        s.getState().setAviso({ tono: "error", texto: "Hay bloques por corregir antes de guardar: están marcados en la lista." });
      } else if (cause instanceof MailApiError && cause.code === "E_COLLECTION_STATE_STALE") {
        s.getState().setAviso({ tono: "error", texto: "Otro cambio del módulo se guardó antes. Vuelve a cargar el correo para no pisarlo." });
      } else {
        s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo guardar el correo.") });
      }
      return false;
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [s, vigente]);

  /** `revision`: la revisión bloquea y hay que ir a verla; `error`: otro motivo, ya avisado. */
  /** Exporta el envío que se mira (lo GUARDADO: si hay cambios, se guardan antes). */
  const exportar = useCallback(async (scope: MailExportScope = "completo"): Promise<"ok" | "revision" | "error"> => {
    if (hayQueGuardar(s.getState())) {
      const ok = await guardar();
      if (!ok) return "error";
    }
    const st = s.getState();
    // El backend exige la revisión que esta vista vio: sin ella no se exporta.
    const revision = st.stateRevision;
    if (revision === null) {
      st.setAviso({ tono: "error", texto: AVISO_SIN_REVISION });
      return "error";
    }
    st.setOcupado(scope === "plantilla" ? "exportando-plantilla" : "exportando");
    // La nota del .pulso que dejó el guardado previo se queda (F6); el resto se limpia.
    if (st.aviso?.texto !== NOTA_DEL_PROYECTO) st.setAviso(null);
    st.setExportacion(null);
    try {
      // Tras guardar, el envío elegido ya tiene su id del servidor.
      const payload = await apiMailExport({ expected_revision: revision, campaign_id: st.campana, scope, send_id: st.envio });
      if (vivo.current) s.getState().setExportacion(payload);
      return "ok";
    } catch (cause) {
      if (!vivo.current) return "error";
      if (cause instanceof MailApiError && cause.code === "E_COLLECTION_MAIL_REVIEW_BLOCKING") {
        s.getState().setAviso({ tono: "error", texto: "La revisión tiene puntos por corregir antes de exportar." });
        void revisar(null);
        return "revision";
      } else if (cause instanceof MailApiError && cause.code === "E_COLLECTION_MAIL_EXPORT_TOO_LARGE") {
        s.getState().setAviso({ tono: "error", texto: "El paquete supera 5 MB: revisa el peso de las imágenes." });
      } else if (cause instanceof MailApiError && cause.code === "E_COLLECTION_STATE_STALE") {
        s.getState().setAviso({ tono: "error", texto: "Otro cambio del módulo se guardó antes. Vuelve a cargar el correo." });
      } else {
        s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo exportar el correo.") });
      }
      return "error";
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [guardar, revisar, s]);

  /**
   * El HTML del envío que se mira, tal como se pega en la plataforma
   * (`mode: "export"`, con sus etiquetas), no el de la vista previa. Se arma
   * sobre el borrador: es lo que la persona está viendo.
   */
  const htmlParaLaPlataforma = useCallback(async (): Promise<string | null> => {
    const pedido = pedidoDelHtmlDeLaPlataforma(s.getState());
    if (!pedido) return null;
    try {
      const preview = await apiMailPreview(pedido);
      return preview.html;
    } catch (cause) {
      if (vivo.current) {
        const envio = envioElegido(s.getState());
        s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, `No se pudo armar el HTML de ${rotuloDeEnvio(envio)}.`) });
      }
      return null;
    }
  }, [s]);

  const guardarJuntoAlProyecto = useCallback(async () => {
    const zip = s.getState().exportacion?.zip;
    if (!zip) return;
    s.getState().setOcupado("guardando");
    try {
      const out = await apiSaveEntregable(zip.file_id, zip.filename, { overwrite: false });
      if (vivo.current) s.getState().setAviso({ tono: "ok", texto: `Guardado junto al proyecto: ${out.filename}` });
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo guardar el paquete junto al proyecto.") });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [s]);

  const importar = useCallback(async (file: File) => {
    // El mapeo adivinado lee los campos de la plantilla GUARDADA.
    if (hayQueGuardar(s.getState()) && !(await guardar())) return;
    s.getState().setOcupado("importando");
    s.getState().setAviso(null);
    try {
      const id = s.getState().campana;
      const destinatarios = await apiMailRecipientsImport(file, null, id);
      if (id && vigente(id)) {
        s.getState().setDestinatarios(destinatarios);
        s.getState().setCampanas((lista) => conDestinatarios(lista, id, destinatarios.loaded));
      }
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: avisoDeImportacion(cause) });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [guardar, s, vigente]);

  const mapear = useCallback(async (mapping: MailRecipientsMapping) => {
    // Un campo nuevo sólo se puede mapear cuando la plantilla que lo declara está guardada.
    if (hayQueGuardar(s.getState()) && !(await guardar())) return;
    s.getState().setOcupado("mapeando");
    try {
      const id = s.getState().campana;
      const destinatarios = await apiMailRecipientsMapping(mapping, id);
      if (id && vigente(id)) s.getState().setDestinatarios(destinatarios);
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo cambiar la columna.") });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [guardar, s, vigente]);

  const olvidar = useCallback(async () => {
    s.getState().setOcupado("olvidando");
    try {
      const id = s.getState().campana;
      const destinatarios = await apiMailRecipientsDelete(id);
      if (id && vigente(id)) {
        s.getState().setDestinatarios(destinatarios);
        s.getState().setCampanas((lista) => conDestinatarios(lista, id, destinatarios.loaded));
      }
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo olvidar la lista.") });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [s, vigente]);

  /**
   * Sube el PNG de una imagen de la cabecera con su mismo id.
   *
   * El backend resuelve cada imagen por el slug del nombre del archivo y se
   * queda con el MÁS RECIENTE: volver a subir `logo-cliente` reemplaza al
   * anterior sin tocar la plantilla. La vista local se recuerda con un
   * `blob:` que el store revoca al reemplazarlo o al salir de la vista; si la
   * vista ya no existe cuando termina la subida, no se crea ninguno.
   */
  const subirImagen = useCallback(async (id: string, file: File) => {
    const st = s.getState();
    if (!st.borrador) return;
    st.setOcupado("subiendo");
    st.setAviso(null);
    try {
      await apiMailImageUpload(file, id);
      if (!vivo.current) return;
      const local = urlLocalDe(file);
      if (local) s.getState().recordarImagen(id, local);
      else s.getState().refrescar();
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: avisoDeImagen(cause) });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [s]);

  return { cargar, guardar, exportar, htmlParaLaPlataforma, guardarJuntoAlProyecto, importar, mapear, olvidar, subirImagen };
}

export type AccionesDeCorreos = ReturnType<typeof useCorreos>;
