/**
 * Estado de la receta en el editor (E1b): lectura, borrador con deshacer y
 * rehacer, la receta guardada contra la que se mide «cambios sin guardar», la
 * unidad de prueba y el guardado con su confirmación.
 *
 * Un reductor puro en vez de un racimo de `useState`: cada transición se prueba
 * sin montar React. La unidad de prueba vive aquí y nunca en la URL: es dato
 * del plan, y la dirección no lleva nada de la unidad.
 */

import type { CollectionMaterialTemplate } from "../../../api/recopiladores";
import {
  createTemplateHistory,
  templateHistoryReducer,
  type TemplateHistory,
} from "../templateHistory";

export type AvisoDelEditor = { tono: "ok" | "error" | "info"; texto: string };

export type EstadoDelEditor = {
  carga: { estado: "cargando" } | { estado: "lista" } | { estado: "error"; mensaje: string };
  historia: TemplateHistory | null;
  /** La receta tal como está guardada en el proyecto. */
  guardada: CollectionMaterialTemplate | null;
  /** Unidad de prueba elegida; `null` = la que elija el backend. */
  unidad: string | null;
  guardando: boolean;
  /** Se pidió guardar y hay fichas que se quedarían viejas: falta confirmar. */
  confirmando: boolean;
  aviso: AvisoDelEditor | null;
  /**
   * `state_revision` que devolvió el último PUT (200 o noop). El payload del
   * módulo la alcanza recién cuando llega el GET /state, segundos después;
   * mientras tanto el siguiente guardado tiene que mandar ésta.
   */
  revisionDelGuardado: number | null;
};

export type AccionDelEditor =
  | { type: "carga-inicio" }
  | { type: "carga-ok"; template: CollectionMaterialTemplate }
  | { type: "carga-error"; mensaje: string }
  | { type: "editar"; template: CollectionMaterialTemplate }
  | { type: "deshacer" }
  | { type: "rehacer" }
  | { type: "unidad"; unidad: string | null }
  | { type: "pedir-confirmacion" }
  | { type: "cancelar-guardado" }
  | { type: "guardado-inicio" }
  | { type: "guardado-ok"; template: CollectionMaterialTemplate | null; noop: boolean; stateRevision?: number | null }
  | { type: "guardado-error"; texto: string }
  | { type: "aviso"; aviso: AvisoDelEditor | null };

export const ESTADO_INICIAL_DEL_EDITOR: EstadoDelEditor = {
  carga: { estado: "cargando" },
  historia: null,
  guardada: null,
  unidad: null,
  guardando: false,
  confirmando: false,
  aviso: null,
  revisionDelGuardado: null,
};

/**
 * La revisión con la que sale el próximo PUT: la mayor entre la que trae el
 * payload del módulo y la que devolvió el último guardado. Nunca baja: un
 * payload viejo no hace retroceder lo que el backend ya confirmó.
 */
export function revisionParaGuardar(delPayload: number | null, delGuardado: number | null): number | null {
  if (delPayload === null) return delGuardado;
  if (delGuardado === null) return delPayload;
  return Math.max(delPayload, delGuardado);
}

export function reducirEditor(estado: EstadoDelEditor, accion: AccionDelEditor): EstadoDelEditor {
  switch (accion.type) {
    case "carga-inicio":
      // Recargar (o cambiar de proyecto) vuelve a la revisión del payload.
      return { ...estado, carga: { estado: "cargando" }, aviso: null, revisionDelGuardado: null };
    case "carga-ok":
      return {
        ...estado,
        carga: { estado: "lista" },
        historia: createTemplateHistory(accion.template),
        guardada: accion.template,
        confirmando: false,
      };
    case "carga-error":
      return { ...estado, carga: { estado: "error", mensaje: accion.mensaje } };
    case "editar":
      if (!estado.historia) return estado;
      return { ...estado, historia: templateHistoryReducer(estado.historia, { type: "commit", template: accion.template }) };
    case "deshacer":
      if (!estado.historia) return estado;
      return { ...estado, historia: templateHistoryReducer(estado.historia, { type: "undo" }) };
    case "rehacer":
      if (!estado.historia) return estado;
      return { ...estado, historia: templateHistoryReducer(estado.historia, { type: "redo" }) };
    case "unidad":
      return { ...estado, unidad: accion.unidad };
    case "pedir-confirmacion":
      return { ...estado, confirmando: true, aviso: null };
    case "cancelar-guardado":
      return { ...estado, confirmando: false };
    case "guardado-inicio":
      return { ...estado, guardando: true, confirmando: false, aviso: null };
    case "guardado-ok": {
      const template = accion.template ?? estado.historia?.present ?? null;
      return {
        ...estado,
        guardando: false,
        // Guardar fija la receta: lo deshecho antes ya no es de esta revisión.
        historia: template ? createTemplateHistory(template) : estado.historia,
        guardada: template ?? estado.guardada,
        revisionDelGuardado: revisionParaGuardar(accion.stateRevision ?? null, estado.revisionDelGuardado),
        aviso: { tono: "ok", texto: accion.noop ? "No había cambios que guardar." : "Receta guardada." },
      };
    }
    case "guardado-error":
      return { ...estado, guardando: false, aviso: { tono: "error", texto: accion.texto } };
    case "aviso":
      return { ...estado, aviso: accion.aviso };
  }
}
