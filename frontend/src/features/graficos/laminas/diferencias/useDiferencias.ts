// Lecturas de los endpoints de diferencias (ADR 0128 §5) con su caché efímera en el store del feature.
//
// El backend calcula sobre el plan GUARDADO: lo que se pide con cambios sin guardar se marca `sucio` y se vuelve a pedir
// cuando el autosave deja el plan limpio. Mientras tanto se sigue mostrando lo último que llegó para esa misma clave.

import { useCallback, useEffect } from "react";
import { ApiError } from "../../../../api/core";
import {
  getDiferencias,
  getDiferenciasInforme,
  type DiferenciasInformeRespuesta,
  type DiferenciasLaminaRespuesta,
} from "../../../../api/graficosDiferencias";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { entradaDeGrafico, nombreDeEntrada } from "../../catalogoGraficos";
import { claveDiferencias, type CargaDiferencias } from "./modeloDiferencias";
import type { NombreDeGrafico } from "./modeloRanuras";
import { useDiferenciasUi } from "./store";

const ESPERA_MS = 300;

/** Un fallo de red o del backend como carga en error: código `E_*` y, si viaja en el mensaje, su `error_id`. */
export function cargaDeError<T>(e: unknown): CargaDiferencias<T> {
  const code = e instanceof ApiError ? e.code : "";
  const crudo = e instanceof Error ? e.message : String(e);
  const message = code ? crudo.replace(new RegExp(`\\s*·\\s*${code}$`), "") : crudo;
  const id = /error_id[^A-Za-z0-9]+([A-Za-z0-9-]+)/.exec(crudo)?.[1] ?? null;
  return { estado: "error", code, message, error_id: id };
}

const abortado = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/**
 * Las diferencias de una lámina. `clave` resume lo que cambia el resultado (pregunta, cruce, interruptor): si cambia,
 * se vuelve a pedir. `activo = false` no pide (sin cruce o con el interruptor apagado).
 */
export function useDiferenciasLamina(slideId: string | null, clave: string, activo: boolean) {
  const version = useDiferenciasUi((s) => s.version);
  const entrada = useDiferenciasUi((s) => (slideId ? s.laminas[slideId] : undefined));
  const dirty = usePlanStore((s) => s.dirty);
  const claveVigente = `${clave}|v${version}`;

  const pedir = useCallback((id: string, k: string, sucio: boolean, senal?: AbortSignal) => {
    const previa = useDiferenciasUi.getState().laminas[id];
    const datos = previa && previa.clave === k && previa.carga.estado !== "error" ? previa.carga.datos : undefined;
    useDiferenciasUi.getState().setCargaLamina(id, { clave: k, carga: { estado: "cargando", datos }, sucio });
    getDiferencias(id, { signal: senal })
      .then((r) => useDiferenciasUi.getState().setCargaLamina(id, { clave: k, carga: { estado: "listo", datos: r }, sucio }))
      .catch((e: unknown) => {
        if (abortado(e)) return;
        useDiferenciasUi.getState().setCargaLamina(id, { clave: k, carga: cargaDeError<DiferenciasLaminaRespuesta>(e), sucio });
      });
  }, []);

  useEffect(() => {
    if (!activo || !slideId) return;
    const actual = useDiferenciasUi.getState().laminas[slideId];
    const mismaClave = actual?.clave === claveVigente;
    // Con el plan sin guardar sólo se pide si no hay nada para esta clave; guardado, si lo último se pidió sucio.
    // Una carga a medias se vuelve a pedir: la limpieza del efecto anterior la abortó.
    if (mismaClave && actual.carga.estado !== "cargando" && (dirty || !actual.sucio)) return;
    const control = new AbortController();
    const t = window.setTimeout(() => pedir(slideId, claveVigente, dirty, control.signal), ESPERA_MS);
    return () => { window.clearTimeout(t); control.abort(); };
  }, [activo, slideId, claveVigente, dirty, pedir]);

  const reintentar = useCallback(() => { if (slideId) pedir(slideId, claveVigente, usePlanStore.getState().dirty); }, [pedir, slideId, claveVigente]);
  const carga = entrada && entrada.clave === claveVigente ? entrada.carga : undefined;
  return { carga, reintentar };
}

/** La revisión en lote del informe; se pide al abrir el panel y otra vez tras guardar el plan o aplicar una regla. */
export function useDiferenciasInforme(activo: boolean) {
  const informe = useDiferenciasUi((s) => s.informe);
  const version = useDiferenciasUi((s) => s.version);
  const dirty = usePlanStore((s) => s.dirty);

  const pedir = useCallback((senal?: AbortSignal) => {
    const previa = useDiferenciasUi.getState().informe;
    const datos = previa && previa.estado !== "error" ? previa.datos : undefined;
    useDiferenciasUi.getState().setInforme({ estado: "cargando", datos });
    getDiferenciasInforme({ signal: senal })
      .then((r) => useDiferenciasUi.getState().setInforme({ estado: "listo", datos: r }))
      .catch((e: unknown) => {
        if (abortado(e)) return;
        useDiferenciasUi.getState().setInforme(cargaDeError<DiferenciasInformeRespuesta>(e));
      });
  }, []);

  useEffect(() => {
    if (!activo) return;
    // Con el plan sin guardar se espera al autosave, salvo que todavía no haya nada que mostrar.
    const previa = useDiferenciasUi.getState().informe;
    if (dirty && previa && previa.estado !== "cargando") return;
    const control = new AbortController();
    const t = window.setTimeout(() => pedir(control.signal), ESPERA_MS);
    return () => { window.clearTimeout(t); control.abort(); };
  }, [activo, dirty, version, pedir]);

  const reintentar = useCallback(() => pedir(), [pedir]);
  return { carga: informe, reintentar };
}

/** La huella de la lámina (sus ranuras de gráfico) que comparten el inspector y «Por qué»; es un texto, así que estable. */
export function useClaveDiferencias(slideId: string | null): string {
  return usePlanStore((s) => {
    const slide = slideId ? s.plan.slides.find((x) => x.id === slideId) : undefined;
    if (!slide) return "";
    const payload = (slide.payload ?? {}) as Record<string, unknown>;
    return claveDiferencias((SLIDE_GRAF_SLOTS[slide.tipo] ?? []).map((slot) => payload[slot] as { graficador?: unknown; args?: unknown } | undefined));
  });
}

type RefGrafico = { graficador?: unknown; args?: unknown } | undefined;

/**
 * El nombre de catálogo (o de variante) del gráfico de cada ranura, con los args guardados. Con `slideId`, el de esa
 * lámina; sin él (la revisión del informe), el de la lámina de cada ranura (`slide_id`).
 */
export function useNombreDeGrafico(slideId: string | null = null): NombreDeGrafico {
  const slides = usePlanStore((s) => s.plan.slides);
  return useCallback((ranura) => {
    const id = slideId ?? ranura.slide_id;
    const payload = slides.find((x) => x.id === id)?.payload as Record<string, unknown> | undefined;
    const ref = payload?.[ranura.ranura] as RefGrafico;
    const graficador = ranura.graficador || (typeof ref?.graficador === "string" ? ref.graficador : "");
    if (!graficador) return "";
    const args = ref && typeof ref.args === "object" && ref.args ? (ref.args as Record<string, unknown>) : {};
    return nombreDeEntrada(entradaDeGrafico(graficador, args));
  }, [slides, slideId]);
}
