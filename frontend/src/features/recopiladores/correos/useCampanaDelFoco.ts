import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { conNivel } from "../../../lib/navegacion/direccion";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { focoDeSeleccion, parseFocoCorreo, seleccionDelFoco } from "./modeloCampanas";
import { useCorreosStore } from "./store";

export type CambioDeDireccion = { foco?: string | null; panel?: string | null };

/**
 * La campaña y el bloque que se miran los dice la dirección (§6 del contrato):
 * `?foco=<campaign_id>` o `?foco=<campaign_id>~<block_id>`.
 *
 * - Un foco vacío o que ya no resuelve se reescribe con `replace` a la
 *   primera campaña; sin campañas, se borra.
 * - Al cambiar la campaña del foco, el store olvida la anterior
 *   (`reiniciarCampana`) y `useCorreos` carga la nueva.
 * - El bloque se sincroniza en los dos sentidos: al llegar a una campaña manda
 *   la URL (un enlace guardado abre su bloque); después, elegir un bloque en
 *   el editor reescribe el foco. Un bloque que no existe en la plantilla se
 *   quita del foco.
 */
export function useCampanaDelFoco() {
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useDireccion();
  const campanas = useCorreosStore((s) => s.campanas);
  const campanasCarga = useCorreosStore((s) => s.campanasCarga);
  const campana = useCorreosStore((s) => s.campana);
  const carga = useCorreosStore((s) => s.carga);
  const seleccion = useCorreosStore((s) => s.seleccion);
  const borrador = useCorreosStore((s) => s.borrador);
  const focoCrudo = direccion?.foco ?? "";
  const foco = useMemo(() => parseFocoCorreo(focoCrudo, campanas), [focoCrudo, campanas]);
  /** Último foco que este hook dejó en la URL (o que adoptó de ella). */
  const ultimo = useRef<string | null>(null);

  const ir = useCallback((cambio: CambioDeDireccion, replace = true) => {
    let search = location.search;
    if ("foco" in cambio) search = conNivel(search, "foco", cambio.foco ?? null);
    if ("panel" in cambio) search = conNivel(search, "panel", cambio.panel ?? null);
    if (search === location.search) return;
    navigate({ pathname: location.pathname, search }, { replace });
  }, [location.pathname, location.search, navigate]);

  // Foco que no resuelve → su forma canónica, sin entrada en el historial.
  useEffect(() => {
    if (campanasCarga !== "lista" || !foco.reescribir) return;
    ir({ foco: foco.canonico });
  }, [campanasCarga, foco.canonico, foco.reescribir, ir]);

  // Otra campaña en el foco: se olvida la anterior y se carga ésta.
  useEffect(() => {
    if (campanasCarga !== "lista") return;
    if (foco.campaignId === campana) return;
    ultimo.current = null;
    useCorreosStore.getState().reiniciarCampana(foco.campaignId);
  }, [campana, campanasCarga, foco.campaignId]);

  // Bloque elegido ↔ foco.
  useEffect(() => {
    if (carga !== "lista" || !campana || campana !== foco.campaignId || foco.reescribir) return;
    const deLaVista = focoDeSeleccion(campana, seleccion);
    if (focoCrudo === deLaVista) {
      ultimo.current = focoCrudo;
      return;
    }
    if (focoCrudo !== ultimo.current) {
      // La URL cambió por fuera (enlace, primera carga): manda la URL.
      const elegido = seleccionDelFoco(foco.blockId, borrador);
      if (elegido === null) {
        ultimo.current = deLaVista;
        ir({ foco: deLaVista });
        return;
      }
      ultimo.current = focoCrudo;
      useCorreosStore.getState().seleccionar(elegido);
      return;
    }
    // Se eligió otro bloque en el editor: se escribe el foco.
    ultimo.current = deLaVista;
    ir({ foco: deLaVista });
  }, [borrador, campana, carga, foco.blockId, foco.campaignId, foco.reescribir, focoCrudo, ir, seleccion]);

  return { foco, ir };
}
