import { useCallback, useEffect, useReducer, useRef } from "react";

import { ApiError } from "../../../api/core";
import {
  apiRecopiladoresMaterialTemplateGet,
  apiRecopiladoresMaterialTemplatePut,
  type CollectionMaterialTemplate,
  type CollectionMaterialTemplatePayload,
} from "../../../api/recopiladores";
import { templateHistoryShortcut } from "../templateHistory";
import { ESTADO_INICIAL_DEL_EDITOR, reducirEditor, revisionParaGuardar, type AccionDelEditor } from "./estadoEditor";
import { estadoDelGuardado } from "./guardadoDeReceta";
import { hayCambiosSinGuardar } from "./modeloEditor";

const ESTADO_VIEJO = "E_COLLECTION_STATE_STALE";

function mensajeDe(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError && cause.code === ESTADO_VIEJO) {
    return "Otro cambio del módulo se guardó antes. Vuelve a cargar la receta para no pisarlo.";
  }
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/** El PUT devuelve `noop` cuando la receta enviada es igual a la guardada. */
function fueNoop(payload: CollectionMaterialTemplatePayload): boolean {
  return (payload as CollectionMaterialTemplatePayload & { noop?: unknown }).noop === true;
}

/**
 * Guarda el borrador con la revisión que la vista leyó y dice cómo terminó.
 * Separado del hook para probarlo sin montar React.
 */
export async function guardarReceta(
  revision: number,
  borrador: CollectionMaterialTemplate,
): Promise<AccionDelEditor> {
  try {
    const result = await apiRecopiladoresMaterialTemplatePut({ expected_revision: revision, template: borrador });
    const stateRevision = typeof result.state_revision === "number" && Number.isFinite(result.state_revision)
      ? result.state_revision
      : null;
    return { type: "guardado-ok", template: result.template, noop: fueNoop(result), stateRevision };
  } catch (cause) {
    return { type: "guardado-error", texto: mensajeDe(cause, "No se pudo guardar la receta.") };
  }
}

/**
 * La receta del editor: la lee, guarda el borrador con su historia y la
 * guarda con la revisión que la vista leyó.
 */
export function useRecetaDelEditor(opts: {
  /** `state_revision` del módulo; sin ella no se guarda. */
  revision: number | null;
  /** Unidades del plan cubiertas por fichas vigentes: guardar las deja viejas. */
  fichasCreadas: number;
  onStateRefresh: () => Promise<void>;
}) {
  const [estado, dispatch] = useReducer(reducirEditor, ESTADO_INICIAL_DEL_EDITOR);
  const vivo = useRef(true);
  const { fichasCreadas, onStateRefresh } = opts;
  // El payload se relee después de guardar y tarda: hasta que alcance la
  // revisión que devolvió el PUT, el siguiente guardado manda ésa.
  const revision = revisionParaGuardar(opts.revision, estado.revisionDelGuardado);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(async () => {
    dispatch({ type: "carga-inicio" });
    try {
      const result = await apiRecopiladoresMaterialTemplateGet();
      if (!vivo.current) return;
      // Sin receta no se inventa una: se guardaría sobre el estado real una
      // ficha que el motor nunca produjo.
      if (!result.template) {
        dispatch({ type: "carga-error", mensaje: "No llegó la receta en uso; el editor no se abre para no guardar una inventada." });
        return;
      }
      dispatch({ type: "carga-ok", template: result.template });
    } catch (cause) {
      if (vivo.current) dispatch({ type: "carga-error", mensaje: mensajeDe(cause, "No se pudo leer la receta.") });
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    const onSession = () => { void cargar(); };
    window.addEventListener("pulso:session-changed", onSession);
    return () => window.removeEventListener("pulso:session-changed", onSession);
  }, [cargar]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const accion = templateHistoryShortcut(event);
      if (!accion) return;
      event.preventDefault();
      dispatch({ type: accion === "undo" ? "deshacer" : "rehacer" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const borrador = estado.historia?.present ?? null;
  const conCambios = hayCambiosSinGuardar(borrador, estado.guardada);

  const editar = useCallback((template: CollectionMaterialTemplate) => {
    dispatch({ type: "editar", template });
  }, []);

  const guardado = estadoDelGuardado({
    hayBorrador: borrador !== null,
    revision,
    conCambios,
    guardando: estado.guardando,
    fichasCreadas,
  });

  const confirmarGuardado = useCallback(async () => {
    // Sin cambios no sale el PUT (también si se deshizo todo mientras se
    // esperaba la confirmación): guardar vacío dejaría viejas las fichas.
    if (!borrador || revision === null || !conCambios) {
      if (!conCambios) dispatch({ type: "cancelar-guardado" });
      return;
    }
    dispatch({ type: "guardado-inicio" });
    const resultado = await guardarReceta(revision, borrador);
    if (!vivo.current) return;
    // «Guardando…» dura lo que el PUT; el refresco no lo retiene porque la
    // revisión que devolvió ya queda en el estado para el siguiente guardado.
    dispatch(resultado);
    // Guardar sube `state_revision` y deja viejas las fichas: se relee.
    if (resultado.type === "guardado-ok") await onStateRefresh();
  }, [borrador, conCambios, onStateRefresh, revision]);

  /** «Guardar receta»: sin cambios no hace nada; con fichas creadas, primero avisa. */
  const guardar = useCallback(() => {
    if (guardado.accion === "confirmar") {
      dispatch({ type: "pedir-confirmacion" });
      return;
    }
    if (guardado.accion === "guardar") void confirmarGuardado();
  }, [confirmarGuardado, guardado.accion]);

  return { estado, dispatch, borrador, conCambios, guardado, cargar, editar, guardar, confirmarGuardado };
}

export type RecetaDelEditor = ReturnType<typeof useRecetaDelEditor>;
