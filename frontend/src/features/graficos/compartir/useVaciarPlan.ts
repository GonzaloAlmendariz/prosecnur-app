// Hook único de «Vaciar el plan» (C14). La barra de Láminas pinta la confirmación en línea (`ConfirmacionCompartir`);
// el header del Editor de la era ggplot pregunta con el diálogo nativo. Los dos pasan por `vaciarSiConfirmado`.

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { GraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { disponibilidadCompartir, type Disponibilidad } from "./disponibilidadCompartir";
import { textoConfirmarVaciar, type TextoConfirmacion } from "./textosConfirmacion";
import { disponibilidadVaciarPlan, ESTADO_VACIAR_INICIAL, vaciarReducer, vaciarSiConfirmado } from "./vaciarPlan";

const MENSAJE_MS = 3200;

export type ControlVaciar = {
  disponibilidad: Disponibilidad;
  texto: TextoConfirmacion;
  /** Hay una confirmación abierta esperando respuesta. */
  pendiente: boolean;
  mensaje: string;
  /** Abre la confirmación; no vacía. */
  pedir: () => void;
  cancelar: () => void;
  /** Vacía si la confirmación está abierta. */
  confirmar: () => void;
  /** Para quien confirma con un diálogo propio: `preguntar` decide, y sólo un `true` vacía. */
  vaciarSi: (preguntar: (texto: TextoConfirmacion) => boolean) => void;
};

export function useVaciarPlan(scope: GraficosReportScope): ControlVaciar {
  const nLaminas = usePlanStore((s) => s.plan.slides.length);
  const reset = usePlanStore((s) => s.reset);
  const [estado, despachar] = useReducer(vaciarReducer, ESTADO_VACIAR_INICIAL);
  const disponibilidad = useMemo(() => disponibilidadVaciarPlan(disponibilidadCompartir(scope), nLaminas), [scope, nLaminas]);
  const texto = useMemo(() => textoConfirmarVaciar(scope, nLaminas), [scope, nLaminas]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const hecho = useCallback(() => {
    despachar({ tipo: "hecho" });
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => despachar({ tipo: "limpiar-mensaje" }), MENSAJE_MS);
  }, []);

  const pedir = useCallback(() => { if (disponibilidad.habilitado) despachar({ tipo: "pedir" }); }, [disponibilidad.habilitado]);
  const cancelar = useCallback(() => despachar({ tipo: "cancelar" }), []);
  const confirmar = useCallback(() => {
    if (vaciarSiConfirmado(estado.pendiente, disponibilidad, reset)) hecho();
    else despachar({ tipo: "cancelar" });
  }, [estado.pendiente, disponibilidad, reset, hecho]);
  const vaciarSi = useCallback((preguntar: (t: TextoConfirmacion) => boolean) => {
    if (!disponibilidad.habilitado) return;
    if (vaciarSiConfirmado(preguntar(texto), disponibilidad, reset)) hecho();
  }, [disponibilidad, texto, reset, hecho]);

  return { disponibilidad, texto, pendiente: estado.pendiente, mensaje: estado.mensaje, pedir, cancelar, confirmar, vaciarSi };
}
