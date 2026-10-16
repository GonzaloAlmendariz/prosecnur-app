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
  type MailRecipientsMapping,
  type MailTemplate,
} from "../../../api/materialMail";
import { huellaDeEdicion } from "./modeloCorreo";
import { hayCambios, hayQueGuardar, useCorreosStore } from "./store";

const GUARDADA_INVALIDA = "E_COLLECTION_MAIL_TEMPLATE_STORED_INVALID";

/** Exportar exige la revisión que la vista leyó; sin ella no se sabe qué se exporta. */
export const AVISO_SIN_REVISION = "No se sabe qué versión del correo está guardada. Vuelve a cargar el correo antes de exportar.";

/** Textos propios para los rechazos del import que la persona sí puede corregir. */
const AVISO_DE_IMPORTACION: Record<string, string> = {
  E_COLLECTION_MAIL_RECIPIENTS_NO_HEADER: "La primera fila parece un destinatario; agrega una fila de encabezados.",
  E_COLLECTION_MAIL_RECIPIENTS_ENCODING: "No se reconoce la codificación del archivo. Guárdalo como «CSV UTF-8» o como XLSX.",
};

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
 */
export function useCorreos() {
  const s = useCorreosStore;
  const borrador = useCorreosStore((st) => st.borrador);
  const persona = useCorreosStore((st) => st.persona);
  const carga = useCorreosStore((st) => st.carga);
  const destinatariosHuella = useCorreosStore((st) => (st.destinatarios
    ? `${st.destinatarios.imported_at ?? ""}|${JSON.stringify(st.destinatarios.mapping)}`
    : ""));
  const refresco = useCorreosStore((st) => st.refresco);
  const huella = huellaDeEdicion(borrador);
  const turnoVista = useRef(0);
  const turnoRevision = useRef(0);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(async () => {
    s.getState().cargaInicio();
    try {
      const [presets, plantilla, destinatarios] = await Promise.all([
        apiMailPresets(),
        apiMailTemplate(),
        apiMailRecipients(),
      ]);
      if (!vivo.current) return;
      s.getState().cargaLista({ presets: presets.presets, plantilla, destinatarios });
      if (plantilla.stored_problems.length) s.getState().setAviso({ tono: "error", texto: AVISO_GUARDADA_INVALIDA });
      // Miniaturas de las plantillas reales: el mismo render, con la persona de ejemplo.
      for (const preset of presets.presets) {
        apiMailPreview({ mode: "preview", template: preset.template }).then(
          (preview) => { if (vivo.current) s.getState().setMiniatura(preset.preset_id, preview.html); },
          () => { if (vivo.current) s.getState().setMiniatura(preset.preset_id, null); },
        );
      }
    } catch (cause) {
      if (vivo.current) s.getState().cargaError(mensajeDe(cause, "No se pudo leer el correo."));
    }
  }, [s]);

  useEffect(() => {
    s.getState().reiniciar();
    void cargar();
    const onSession = () => {
      s.getState().reiniciar();
      void cargar();
    };
    window.addEventListener("pulso:session-changed", onSession);
    return () => {
      window.removeEventListener("pulso:session-changed", onSession);
      // Los destinatarios no sobreviven a la vista: al salir se olvida el resumen.
      s.getState().reiniciar();
    };
  }, [cargar, s]);

  // Vista previa del borrador, para la persona elegida.
  useEffect(() => {
    if (carga !== "lista") return;
    const template = s.getState().borrador;
    if (!template) return;
    const turno = ++turnoVista.current;
    const timer = window.setTimeout(() => {
      s.getState().vistaPreviaInicio();
      apiMailPreview({ mode: "preview", recipient_index: persona, template }).then(
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
  }, [carga, huella, persona, refresco, s]);

  // Revisión del borrador: también depende de la lista de destinatarios.
  const revisar = useCallback(async (template: MailTemplate | null) => {
    const turno = ++turnoRevision.current;
    s.getState().revisionInicio();
    try {
      const review = await apiMailReview({ template });
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
    const timer = window.setTimeout(() => { void revisar(template); }, ESPERA_REVISION_MS);
    return () => window.clearTimeout(timer);
  }, [carga, huella, destinatariosHuella, refresco, revisar, s]);

  /** Guarda el borrador. Devuelve `false` si no se pudo. */
  const guardar = useCallback(async (): Promise<boolean> => {
    const st = s.getState();
    if (!st.borrador || st.stateRevision === null) return false;
    if (!hayQueGuardar(st) && !st.builtin) return true;
    st.setOcupado("guardando");
    st.setAviso(null);
    try {
      const payload = await apiMailTemplatePut({ template: st.borrador, expected_revision: st.stateRevision });
      if (!vivo.current) return true;
      s.getState().guardado(payload);
      s.getState().setAviso({ tono: "ok", texto: payload.noop ? "No había cambios que guardar." : "Correo guardado." });
      return true;
    } catch (cause) {
      if (!vivo.current) return false;
      if (cause instanceof MailApiError && cause.problems.length) {
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
  }, [s]);

  /** `revision`: la revisión bloquea y hay que ir a verla; `error`: otro motivo, ya avisado. */
  const exportar = useCallback(async (): Promise<"ok" | "revision" | "error"> => {
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
    st.setOcupado("exportando");
    st.setAviso(null);
    st.setExportacion(null);
    try {
      const payload = await apiMailExport({ expected_revision: revision });
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
      const destinatarios = await apiMailRecipientsImport(file);
      if (vivo.current) s.getState().setDestinatarios(destinatarios);
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: avisoDeImportacion(cause) });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [guardar, s]);

  const mapear = useCallback(async (mapping: MailRecipientsMapping) => {
    // Un campo nuevo sólo se puede mapear cuando la plantilla que lo declara está guardada.
    if (hayQueGuardar(s.getState()) && !(await guardar())) return;
    s.getState().setOcupado("mapeando");
    try {
      const destinatarios = await apiMailRecipientsMapping(mapping);
      if (vivo.current) s.getState().setDestinatarios(destinatarios);
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo cambiar la columna.") });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [guardar, s]);

  const olvidar = useCallback(async () => {
    s.getState().setOcupado("olvidando");
    try {
      const destinatarios = await apiMailRecipientsDelete();
      if (vivo.current) s.getState().setDestinatarios(destinatarios);
    } catch (cause) {
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo olvidar la lista.") });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [s]);

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
      if (vivo.current) s.getState().setAviso({ tono: "error", texto: mensajeDe(cause, "No se pudo subir la imagen.") });
    } finally {
      if (vivo.current) s.getState().setOcupado(null);
    }
  }, [s]);

  return { cargar, guardar, exportar, guardarJuntoAlProyecto, importar, mapear, olvidar, subirImagen };
}

export type AccionesDeCorreos = ReturnType<typeof useCorreos>;
