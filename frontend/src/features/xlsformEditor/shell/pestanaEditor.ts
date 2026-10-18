// Pestaña activa del editor de formularios (rail izquierdo, 2026-10-15). La dirección manda: `?pestana=<id>`.
// Sin pestaña, o con una que no existe, se abre el Constructor. Los paneles que el rail no lista siguen en `?panel=`.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  EDITOR_FORMULARIOS_PESTANAS,
  PESTANA_EDITOR_POR_DEFECTO,
  type EditorFormulariosPestanaId,
} from "../../../lib/navegacion/catalogos/editorFormularios";
import { conNivel, normalizarToken } from "../../../lib/navegacion/direccion";
import { searchConNivel, useSeccion } from "../../../lib/navegacion/useDireccion";

export type { EditorFormulariosPestanaId };
export const PESTANAS_EDITOR = EDITOR_FORMULARIOS_PESTANAS;

/** Valores del toggle y del menú de antes: un enlace guardado abre la pestaña nueva. Nunca se escriben. */
const ALIAS_PESTANAS_EDITOR: Readonly<Record<string, EditorFormulariosPestanaId>> = {
  builder: "constructor",
  sheets: "hojas",
  "mapa-logica": "logica",
  "logic-canvas": "logica",
  "choice-filters": "filtros",
  // El catálogo era un panel lateral (`?panel=catalogos`) y un diálogo (`?panel=listas-opciones`); hoy es pestaña.
  catalogos: "opciones",
  listas: "opciones",
  "questionnaire-view": "cuestionario",
  simulator: "probar",
  summary: "resumen",
  pdf: "impreso",
  documento: "impreso",
};

export function resolverPestanaEditor(pedida: string | null | undefined): EditorFormulariosPestanaId {
  const token = normalizarToken(pedida ?? "");
  const canonica = PESTANAS_EDITOR.find((p) => p.key === token)?.key;
  if (canonica) return canonica;
  return ALIAS_PESTANAS_EDITOR[token] ?? PESTANA_EDITOR_POR_DEFECTO;
}

export type ControlPestanaEditor = {
  pestana: EditorFormulariosPestanaId;
  /** `foco` de la dirección: en el Constructor, el `name` de la pregunta a enfocar. */
  foco: string | null;
  panel: string | null;
  ir: (pestana: EditorFormulariosPestanaId, opciones?: { replace?: boolean }) => void;
  /** Lleva al Constructor con `foco=<name>`: la pregunta queda seleccionada. */
  irAPregunta: (name: string) => void;
  /** Lleva a otra pestaña con su `foco` ya elegido (la ficha del Constructor abre Restricciones con la pregunta). */
  irConFoco: (pestana: EditorFormulariosPestanaId, foco: string | null) => void;
  /** Reescribe el `foco` sin cambiar de pestaña (la parte elegida de «Impreso», la ficha abierta del Cuestionario…). */
  fijarFoco: (valor: string | null, opciones?: { replace?: boolean }) => void;
};

export function usePestanaEditor(): ControlPestanaEditor {
  const control = useSeccion("editor-xlsform");
  const location = useLocation();
  const navigate = useNavigate();
  const pestana = resolverPestanaEditor(control.pestana);
  // El `foco` es de la pestaña (la pregunta del Constructor, la parte de Impreso): cambiar de pestaña lo descarta.
  const ir = useCallback(
    (destino: EditorFormulariosPestanaId, opciones?: { replace?: boolean }) => {
      const search = conNivel(searchConNivel(location.search, "pestana", destino), "foco", null);
      navigate({ pathname: location.pathname, search }, { replace: opciones?.replace ?? false });
    },
    [location.pathname, location.search, navigate],
  );
  const irAPregunta = useCallback((name: string) => {
    const search = conNivel(searchConNivel(location.search, "pestana", "constructor"), "foco", name);
    navigate({ pathname: location.pathname, search });
  }, [location.pathname, location.search, navigate]);
  const irConFoco = useCallback((destino: EditorFormulariosPestanaId, foco: string | null) => {
    const search = conNivel(searchConNivel(location.search, "pestana", destino), "foco", foco);
    navigate({ pathname: location.pathname, search });
  }, [location.pathname, location.search, navigate]);
  const fijarFoco = useCallback((valor: string | null, opciones?: { replace?: boolean }) => {
    navigate(
      { pathname: location.pathname, search: conNivel(location.search, "foco", valor) },
      { replace: opciones?.replace ?? false },
    );
  }, [location.pathname, location.search, navigate]);
  return { pestana, foco: control.foco, panel: control.panel, ir, irAPregunta, irConFoco, fijarFoco };
}
