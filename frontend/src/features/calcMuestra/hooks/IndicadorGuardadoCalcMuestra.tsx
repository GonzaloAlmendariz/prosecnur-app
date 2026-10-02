/**
 * Indicador de guardado del estudio de Cálculo de muestra. Sólo se pinta si
 * el autosave falló (el porqué, junto al return). `estadoGuardado` distingue:
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
  return <VistaIndicadorGuardado estado={estadoGuardado({ dirty, guardando, errorGuardado })} />;
}

/**
 * Sólo el fallo se dice. Este guardado es la copia de trabajo de la sesión,
 * no el .pulso: un «Guardado» verde aquí contradecía el «sin guardar» del
 * proyecto arriba a la derecha, la misma palabra para dos cosas (Gonzalo,
 * 2026-10-02). Lo que sí importa saber es que el autosave falló.
 */
export function VistaIndicadorGuardado({ estado }: { estado: SaveState }) {
  if (estado !== "error") return null;
  return <SaveStatusIndicator state={estado} variant="badge" />;
}
