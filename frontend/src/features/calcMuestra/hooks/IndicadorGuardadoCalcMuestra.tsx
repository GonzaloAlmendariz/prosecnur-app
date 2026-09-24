/**
 * Indicador de guardado del estudio de Cálculo de muestra. Dice lo que pasa:
 * «Cambios sin guardar» mientras el autosave espera su debounce (2 s),
 * «Guardando…» sólo con el PUT en vuelo y «Error al guardar» si el último
 * falló. Antes mostraba «Guardando…» apenas había un cambio y, si el PUT
 * fallaba, se quedaba así para siempre sin avisar.
 */
import { SaveStatusIndicator, type SaveState } from "../../../components/SaveStatusIndicator";
import { useCalcMuestraStore } from "../store";

export function estadoGuardado(s: { dirty: boolean; guardando: boolean; errorGuardado: boolean }): SaveState {
  if (s.guardando) return "saving";
  if (s.errorGuardado) return "error";
  return s.dirty ? "dirty" : "saved";
}

export function IndicadorGuardadoCalcMuestra() {
  const dirty = useCalcMuestraStore((s) => s.dirty);
  const guardando = useCalcMuestraStore((s) => s.guardando);
  const errorGuardado = useCalcMuestraStore((s) => s.errorGuardado);
  return <SaveStatusIndicator state={estadoGuardado({ dirty, guardando, errorGuardado })} variant="badge" />;
}
