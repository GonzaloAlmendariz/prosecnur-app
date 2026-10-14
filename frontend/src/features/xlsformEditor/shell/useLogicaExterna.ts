// =============================================================================
// shell/useLogicaExterna.ts — declarar (o deshacer) la lógica hecha fuera
// =============================================================================
// Una sola dueña de la acción para tarjeta, cabecera y ventana de lógica. Sigue
// el mismo camino que la confirmación de lógica (`persistAndConfirmFormLogic`):
//
//   1. despacha el autosave pendiente ANTES de llamar al backend, para que un
//      guardado en vuelo con la procedencia vieja no aterrice después;
//   2. adopta la procedencia que devuelve el backend en la copia local, en la
//      biblioteca y —si es el formulario abierto— en el editor: el autosave
//      manda la procedencia, y una copia vieja revertiría el estado;
//   3. pinta la publicación devuelta y relee el índice.
//
// El diálogo es direccionable: `?panel=logica-externa&foco=<id>`.
// =============================================================================

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { XlsformFormSource } from "../../../api/multiIntegrado";
import {
  apiXlsformFormLogicaExterna,
  type XlsformFormPublication,
} from "../../../api/xlsformEditor";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import {
  listForms,
  updateFormSource,
  type LibraryEntry,
  type ProjectScope,
} from "../state/persistence";
import {
  CONSECUENCIA_LOGICA_EXTERNA,
  PANEL_LOGICA_EXTERNA,
  mensajeDeRechazo,
  searchAbrirLogicaExterna,
  searchCerrarLogicaExterna,
} from "./logicaExternaModel";
import type { UseToastDeck } from "./ToastDeck";

export type AccionesLogicaExterna = {
  /** Formulario con una declaración o un retiro en vuelo. */
  enCursoId: string | null;
  /** Abre el mini-diálogo sobre `formId`. */
  abrirPara: (formId: string) => void;
  declarar: (formId: string, declaracion: { herramienta: string; nota: string }) => Promise<boolean>;
  retirar: (formId: string) => Promise<boolean>;
};

export type ControlLogicaExterna = AccionesLogicaExterna & {
  abierto: boolean;
  /** Formulario sobre el que está abierto el diálogo. */
  formId: string | null;
  cerrar: () => void;
  props: { "data-pulso-panel": string };
};

export type DependenciasLogicaExterna = {
  projectScope: ProjectScope;
  activeFormIdRef: MutableRefObject<string | null>;
  setForms: (forms: LibraryEntry[]) => void;
  setSource: (source: XlsformFormSource | null) => void;
  setPublication: (formId: string, publication: XlsformFormPublication) => void;
  refreshBackendFormIndex: () => Promise<unknown>;
  /** Despacha el autosave pendiente y espera sus POST en vuelo. */
  flushPendiente: () => Promise<unknown>;
  toasts: Pick<UseToastDeck, "push">;
  /** Tras declarar (p. ej., cerrar la ventana de lógica desde la que se abrió). */
  onDeclarada?: (formId: string) => void;
};

export function useLogicaExterna(deps: DependenciasLogicaExterna): ControlLogicaExterna {
  // Las dependencias cambian de identidad en cada render del editor; las
  // acciones leen siempre las últimas sin volver a crearse.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [enCursoId, setEnCursoId] = useState<string | null>(null);

  const panel = usePanelDireccionable(PANEL_LOGICA_EXTERNA);
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();

  const abrirPara = useCallback((formId: string) => {
    navigate(
      { pathname: location.pathname, search: searchAbrirLogicaExterna(location.search, formId) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const cerrar = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: searchCerrarLogicaExterna(location.search) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const adoptar = useCallback((
    formId: string,
    result: { source: XlsformFormSource | null; publication: XlsformFormPublication },
  ) => {
    const d = depsRef.current;
    if (result.source) {
      updateFormSource(d.projectScope, formId, result.source);
      d.setForms(listForms(d.projectScope));
      if (d.activeFormIdRef.current === formId) d.setSource(result.source);
    }
    d.setPublication(formId, result.publication);
    void d.refreshBackendFormIndex().catch(() => undefined);
  }, []);

  const declarar = useCallback(async (
    formId: string,
    declaracion: { herramienta: string; nota: string },
  ): Promise<boolean> => {
    const d = depsRef.current;
    setEnCursoId(formId);
    try {
      await d.flushPendiente().catch(() => undefined);
      const result = await apiXlsformFormLogicaExterna(formId, {
        declarada: true,
        herramienta: declaracion.herramienta,
        nota: declaracion.nota,
      });
      adoptar(formId, result);
      d.toasts.push({
        kind: "success",
        title: "Lógica declarada fuera de Prosecnur",
        detail: `${CONSECUENCIA_LOGICA_EXTERNA} Ya puedes publicar el formulario.`,
        durationMs: 6000,
      });
      d.onDeclarada?.(formId);
      return true;
    } catch (err: unknown) {
      void d.refreshBackendFormIndex().catch(() => undefined);
      d.toasts.push({
        kind: "danger",
        title: "No se guardó la declaración",
        detail: mensajeDeRechazo(err, "El formulario sigue como estaba. Inténtalo nuevamente."),
        durationMs: 7000,
      });
      return false;
    } finally {
      setEnCursoId((actual) => (actual === formId ? null : actual));
    }
  }, [adoptar]);

  const retirar = useCallback(async (formId: string): Promise<boolean> => {
    const d = depsRef.current;
    setEnCursoId(formId);
    try {
      await d.flushPendiente().catch(() => undefined);
      const result = await apiXlsformFormLogicaExterna(formId, { declarada: false });
      adoptar(formId, result);
      d.toasts.push({
        kind: "info",
        title: "Declaración retirada",
        detail: "Revisa la lógica en Prosecnur para publicar una revisión nueva.",
        durationMs: 6000,
      });
      return true;
    } catch (err: unknown) {
      void d.refreshBackendFormIndex().catch(() => undefined);
      d.toasts.push({
        kind: "danger",
        title: "No se pudo deshacer la declaración",
        detail: mensajeDeRechazo(err, "El formulario sigue declarado fuera de Prosecnur."),
        durationMs: 7000,
      });
      return false;
    } finally {
      setEnCursoId((actual) => (actual === formId ? null : actual));
    }
  }, [adoptar]);

  return {
    abierto: panel.abierto,
    formId: panel.abierto ? direccion?.foco ?? null : null,
    abrirPara,
    cerrar,
    props: panel.props,
    enCursoId,
    declarar,
    retirar,
  };
}
