// Pide la propuesta del motor de una lámina de resumen (POST /api/graficos/resumenes/propuesta, api/graficosPropuesta.ts).
// Tarda de 6 a 13 s: se pide al mostrarla y a demanda, nunca por tecla. Si después cambian los ajustes que la deciden
// (cruces, topes, modo), queda marcada como desactualizada hasta que el analista la vuelva a pedir. Lo traído se guarda
// por sesión, alcance y firma de la lámina: volver a la lámina sin cambios no la recalcula.

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getSession } from "../../../../api/core";
import type { Slide } from "../../../../api/graficos";
import { apiGraficosPropuestaResumen, type PropuestaResumen } from "../../../../api/graficosPropuesta";
import { buildGraficosConfigFromStore } from "../../configSnapshot";
import { usePlanStore } from "../../store";
import { firmaLamina } from "./modeloPropuesta";

export type EstadoPropuesta =
  | { fase: "inactiva" }
  | { fase: "cargando" }
  | { fase: "lista"; datos: PropuestaResumen; firma: string }
  | { fase: "error"; mensaje: string };

const guardadas = new Map<string, PropuestaResumen>();
const TOPE = 24;

if (typeof window !== "undefined") {
  for (const ev of ["pulso:session-changed", "pulso:session-lost", "pulso:project-closed", "pulso:active-base-changed",
    "pulso:analitica-source-changed", "pulso:codif-source-changed"]) window.addEventListener(ev, () => guardadas.clear());
}

/** La sesión, o vacío donde no hay almacenamiento (render en servidor, pruebas). */
const sesion = (): string => { try { return getSession() ?? ""; } catch { return ""; } };
const claveDe = (scope: string, firma: string) => `${sesion()}|${scope}|${firma}`;

/** El error del motor dicho para el analista. */
export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "E_PROPUESTA_TIPO") return "El motor sólo propone el resumen ejecutivo y el resumen de diferencias.";
    if (e.code === "E_PROPUESTA_LAMINA_INVALIDA") return "El motor no pudo leer esta lámina. Revisa la pregunta y los cruces.";
    if (e.code === "E_PROPUESTA_SIN_LAMINA") return "Esta lámina ya no está en el informe.";
  }
  return "El motor no pudo armar la propuesta. Vuelve a intentarlo en un momento.";
}

export function usePropuestaResumen(slide: Slide, scope: "active" | "consolidated", autoCargar: boolean) {
  const firma = firmaLamina(slide);
  const [estado, setEstado] = useState<EstadoPropuesta>(() => {
    const ya = guardadas.get(claveDe(scope, firma));
    if (ya) return { fase: "lista", datos: ya, firma };
    return autoCargar ? { fase: "cargando" } : { fase: "inactiva" };
  });
  const pedido = useRef<AbortController | null>(null);
  const fase = useRef(estado.fase);
  fase.current = estado.fase;
  const slideId = slide.id;

  const cargar = useCallback(() => {
    pedido.current?.abort();
    // Se lee la lámina vigente al disparar, no la de un render: es la que se está editando, sin guardar.
    const vigente = usePlanStore.getState().plan.slides.find((s) => s.id === slideId);
    if (!vigente) { setEstado({ fase: "error", mensaje: "Esta lámina ya no está en el informe." }); return; }
    const f = firmaLamina(vigente);
    const k = claveDe(scope, f);
    const ya = guardadas.get(k);
    if (ya) { setEstado({ fase: "lista", datos: ya, firma: f }); return; }
    const ctl = new AbortController();
    pedido.current = ctl;
    setEstado({ fase: "cargando" });
    apiGraficosPropuestaResumen({ slide: vigente, config: buildGraficosConfigFromStore(), scope, signal: ctl.signal })
      .then((datos) => {
        if (ctl.signal.aborted) return;
        guardadas.set(k, datos);
        if (guardadas.size > TOPE) { const primera = guardadas.keys().next().value; if (primera !== undefined) guardadas.delete(primera); }
        setEstado({ fase: "lista", datos, firma: f });
      })
      .catch((e: unknown) => { if (!ctl.signal.aborted) setEstado({ fase: "error", mensaje: mensajeError(e) }); });
  }, [slideId, scope]);

  // Se pide sola al mostrarse con «Los propone el motor»; en «Los escribo yo», sólo cuando el analista la trae.
  useEffect(() => {
    if (autoCargar && fase.current !== "lista" && fase.current !== "error") cargar();
  }, [autoCargar, cargar]);

  useEffect(() => () => pedido.current?.abort(), []);

  const desactualizada = estado.fase === "lista" && estado.firma !== firma;
  return { estado, cargar, desactualizada };
}
