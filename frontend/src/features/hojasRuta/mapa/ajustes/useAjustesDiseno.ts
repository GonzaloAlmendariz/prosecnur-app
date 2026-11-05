import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { conModificador } from "../../../../lib/teclado";
import { estaEscribiendo } from "../../../home/atajosDeModulos";
import { esGrupoAjustes, type GrupoAjustesId } from "./gruposAjustes";
import { PANEL_AJUSTES_DISENO } from "./panelAjustes";

const CLAVE_FOCO_PREVIO = "hr-ajustes-foco-previo";
const leer = () => { try { return sessionStorage.getItem(CLAVE_FOCO_PREVIO); } catch { return null; } };
const guardar = (v: string | null) => { try { if (v) sessionStorage.setItem(CLAVE_FOCO_PREVIO, v); else sessionStorage.removeItem(CLAVE_FOCO_PREVIO); } catch { /* sin almacenamiento: al cerrar se pierde el foco previo */ } };

/**
 * Apertura de «Ajustes del diseño» por dirección: `?panel=ajustes&foco=<grupo>`. En Hojas de ruta `foco` ya
 * es la ciudad abierta (Territorio) o la UMP (Selección): al abrir se guarda el previo y al cerrar se
 * restaura, para que la ventana no cierre la ciudad que estaba abierta debajo. Mod + coma la abre (lib/teclado).
 */
/** Abrir la ventana desde cualquier control (el botón «Diseño», los accesos de cada sección), sin registrar
 * el panel ni el atajo: eso lo hace una sola vez `useAjustesDiseno`, en el host. */
export function useAbrirAjustes() {
  const location = useLocation();
  const navigate = useNavigate();
  const abierto = new URLSearchParams(location.search).get("panel") === PANEL_AJUSTES_DISENO.id;
  const abrir = useCallback((g: GrupoAjustesId = "tamano") => {
    const p = new URLSearchParams(location.search);
    if (p.get("panel") !== PANEL_AJUSTES_DISENO.id) guardar(p.get("foco"));
    p.set("panel", PANEL_AJUSTES_DISENO.id);
    p.set("foco", g);
    navigate({ pathname: location.pathname, search: `?${p.toString()}` }, { replace: true });
  }, [location.pathname, location.search, navigate]);
  return { abierto, abrir };
}

export function useAjustesDiseno() {
  const { abierto } = usePanelDireccionable(PANEL_AJUSTES_DISENO);
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const focoUrl = params.get("foco");
  const grupo: GrupoAjustesId = abierto && esGrupoAjustes(focoUrl) ? focoUrl : "tamano";

  const escribir = useCallback((p: URLSearchParams) => navigate({ pathname: location.pathname, search: `?${p.toString()}` }, { replace: true }), [location.pathname, navigate]);

  const { abrir } = useAbrirAjustes();

  const cerrar = useCallback(() => {
    const p = new URLSearchParams(location.search);
    p.delete("panel");
    const previo = leer();
    if (previo) p.set("foco", previo); else p.delete("foco");
    guardar(null);
    escribir(p);
  }, [location.search, escribir]);

  const irAGrupo = useCallback((g: GrupoAjustesId) => abrir(g), [abrir]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "," || !conModificador(e) || e.altKey || e.shiftKey || e.defaultPrevented || estaEscribiendo(e.target)) return;
      e.preventDefault();
      if (abierto) cerrar(); else abrir();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, abrir, cerrar]);

  return { abierto, grupo, abrir, cerrar, irAGrupo };
}
