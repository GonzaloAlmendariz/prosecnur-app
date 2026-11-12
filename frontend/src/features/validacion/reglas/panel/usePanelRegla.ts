/**
 * El panel de regla vive en la dirección (`panel=regla`, rebanada V2):
 *
 *   - `foco=nueva`: una regla propia nueva; `foco=<id>`: la que se edita.
 *   - `tipo=<clave>`: el tipo elegido de una nueva (sin él, "Qué quieres revisar").
 *   - `pregunta=<variable>`: la pregunta con que llega armada una nueva (Explorar).
 *
 * `tipo` y `pregunta` son parámetros propios del panel, fuera de los cinco
 * niveles de la gramática; la dirección los conserva (`extra`). Cerrar borra
 * el panel y los tres. El enlace viejo al detalle de una regla del formulario
 * (`pestana=instrumento&panel=regla&foco=<id>`) no abre este panel: lleva a la
 * ficha de Reglas (`pestanaValidacion.ts`).
 */
import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { searchConPanel, searchSinPanel, usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { useDireccion } from "../../../../lib/navegacion/useDireccion";
import { PANEL_REGLA_VALIDACION } from "../../panelesValidacion";
import { esAliasDelDetalleDeRegla, searchConPestanaCanonica } from "../../pestanaValidacion";
import { esTipoReglaPropia, type TipoReglaPropia } from "../tiposDelMotor";

export const FOCO_NUEVA = "nueva";
export const PARAM_TIPO = "tipo";
export const PARAM_PREGUNTA = "pregunta";

function conExtra(search: string, clave: string, valor: string | null): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (valor) params.set(clave, valor);
  else params.delete(clave);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** El `search` con el panel abierto en una regla (nueva o por id). */
export function searchConPanelRegla(
  search: string,
  foco: string,
  extra: { tipo?: TipoReglaPropia | null; pregunta?: string | null } = {},
): string {
  // `panel` antes que `foco`, como en toda dirección de la app.
  let siguiente = conNivel(searchConPestanaCanonica(search), "foco", null);
  siguiente = searchConPanel(siguiente, PANEL_REGLA_VALIDACION);
  siguiente = conNivel(siguiente, "foco", foco);
  siguiente = conExtra(siguiente, PARAM_TIPO, extra.tipo ?? null);
  siguiente = conExtra(siguiente, PARAM_PREGUNTA, extra.pregunta ?? null);
  return siguiente;
}

/** El `search` sin el panel ni lo que solo él usa. */
export function searchSinPanelRegla(search: string): string {
  let siguiente = searchSinPanel(search, PANEL_REGLA_VALIDACION);
  siguiente = conNivel(siguiente, "foco", null);
  siguiente = conExtra(siguiente, PARAM_TIPO, null);
  siguiente = conExtra(siguiente, PARAM_PREGUNTA, null);
  return siguiente;
}

export type PanelReglaDireccion = {
  abierto: boolean;
  /** `nueva` o el id de la regla; `null` con el panel cerrado. */
  foco: string | null;
  tipo: TipoReglaPropia | null;
  pregunta: string | null;
  abrirNueva: (extra?: { tipo?: TipoReglaPropia | null; pregunta?: string | null }) => void;
  abrirRegla: (id: string) => void;
  /** Elegir el tipo de una nueva (`null` vuelve a "Qué quieres revisar"). */
  elegirTipo: (tipo: TipoReglaPropia | null) => void;
  cerrar: () => void;
  props: { "data-pulso-panel": string };
};

export function usePanelRegla(): PanelReglaDireccion {
  const control = usePanelDireccionable(PANEL_REGLA_VALIDACION);
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  const alias = esAliasDelDetalleDeRegla(direccion?.pestana, direccion?.panel);
  const abierto = control.abierto && !alias;
  const foco = abierto ? direccion?.foco ?? FOCO_NUEVA : null;
  const tipoCrudo = direccion?.extra?.[PARAM_TIPO] ?? null;
  const tipo = abierto && esTipoReglaPropia(tipoCrudo) ? tipoCrudo : null;
  const pregunta = abierto ? direccion?.extra?.[PARAM_PREGUNTA] ?? null : null;

  const escribir = useCallback(
    (search: string) => navigate({ pathname: location.pathname, search }, { replace: true }),
    [location.pathname, navigate],
  );
  const abrirNueva = useCallback(
    (extra: { tipo?: TipoReglaPropia | null; pregunta?: string | null } = {}) =>
      escribir(searchConPanelRegla(location.search, FOCO_NUEVA, extra)),
    [escribir, location.search],
  );
  const abrirRegla = useCallback((id: string) => escribir(searchConPanelRegla(location.search, id)), [escribir, location.search]);
  const elegirTipo = useCallback(
    (siguiente: TipoReglaPropia | null) => escribir(conExtra(location.search, PARAM_TIPO, siguiente)),
    [escribir, location.search],
  );
  const cerrar = useCallback(() => escribir(searchSinPanelRegla(location.search)), [escribir, location.search]);

  return useMemo(
    () => ({ abierto, foco, tipo, pregunta, abrirNueva, abrirRegla, elegirTipo, cerrar, props: control.props }),
    [abierto, foco, tipo, pregunta, abrirNueva, abrirRegla, elegirTipo, cerrar, control.props],
  );
}
