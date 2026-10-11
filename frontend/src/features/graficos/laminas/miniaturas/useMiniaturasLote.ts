// Orquesta las miniaturas reales de la tira (F6 §5.3; contrato docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md §6):
// pide un lote con `POST /api/graficos/miniaturas` (estado vivo del editor) y pollea cada `GET
// /api/graficos/miniaturas/<lote_id>` vivo para pintar cada lámina conforme llega. Nunca un render masivo síncrono.
// Al desplazarse (Vista general), las láminas recién vistas van en un lote propio con `reemplazar = false`: el lote en
// curso sigue y nada se pide dos veces. Al editar una lámina se reemplaza (`reemplazar = true`) y viajan ésa y, una sola
// vez, las pendientes de los lotes cancelados; el backend decide por huella si re-renderiza. Reglas en
// `loteMiniaturas.ts` (`planPedido`, pura) y estado en `miniaturasStore.ts`.

import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { Slide } from "../../../../api/graficos";
import { apiGraficosMiniaturas, apiGraficosMiniaturasLote, miniaturaSrc } from "../../../../api/graficosMiniaturas";
import { apiJobCancel } from "../../../../api/jobs";
import { useSession } from "../../../../lib/SessionContext";
import { buildGraficosConfigFromStore } from "../../configSnapshot";
import { clavePreview } from "../../previewLaminaCoordinador";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import type { LaminaEnEstructura } from "../modeloEstructura";
import { avanceLote, planPedido, type LaminaClave } from "./loteMiniaturas";
import { useMiniaturasLoteStore } from "./miniaturasStore";
import { iniciarPollLote } from "./pollLote";

/** Primer lote (y los de láminas recién vistas) casi de inmediato; tras una edición se espera a que deje de teclear. */
export const ESPERA_PRIMER_LOTE_MS = 400;
export const ESPERA_EDICION_MS = 1500;

const clavesLocales = new WeakMap<Slide, Map<string, string>>();
function claveLocal(slide: Slide, antetitulo: string | null): string {
  let porAntetitulo = clavesLocales.get(slide);
  if (!porAntetitulo) { porAntetitulo = new Map(); clavesLocales.set(slide, porAntetitulo); }
  const k = antetitulo ?? "\u0000";
  let c = porAntetitulo.get(k);
  if (c === undefined) { c = clavePreview({ slide, antetituloHeredado: antetitulo }); porAntetitulo.set(k, c); }
  return c;
}

type LaminaPedible = LaminaClave & { slide: Slide };

/** `visible`: la tira se ve (en el marco compacto se pliega por CSS y no tiene sentido dibujar lo que nadie mira). */
export function useMiniaturasLote(laminas: readonly LaminaEnEstructura[], visible: boolean) {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  const { state } = useSession();
  const habilitada = (!!state?.analitica_prep_ok || scope === "consolidated") && visible;
  const slides = usePlanStore((s) => s.plan.slides);
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const overrides = usePlanStore((s) => s.overridesReusables);
  const entradas = useMiniaturasLoteStore((s) => s.entradas);
  const vigente = useMiniaturasLoteStore((s) => s.vigente);
  const lotes = useMiniaturasLoteStore((s) => s.lotes);
  const forzadas = useMiniaturasLoteStore((s) => s.forzadas);
  const enVuelo = useMiniaturasLoteStore((s) => s.enVuelo);

  // Misma clave que la vista previa: lámina + antetítulo heredado + estilo global + alcance.
  const global = useMemo(() => clavePreview({ presets, paletas, overrides, scope }), [presets, paletas, overrides, scope]);
  const pedibles = useMemo<LaminaPedible[]>(() => {
    const porId = new Map(slides.map((s) => [s.id, s]));
    return laminas.flatMap((l) => {
      const slide = porId.get(l.id);
      return slide ? [{ id: l.id, slide, clave: `${global}|${claveLocal(slide, l.antetituloHeredado)}` }] : [];
    });
  }, [laminas, slides, global]);

  // Pedir lo que cambió (o lo pendiente sin lote), con espera para no lanzar un lote por tecla.
  useEffect(() => {
    if (!habilitada || enVuelo || !pedibles.length) return;
    const store = useMiniaturasLoteStore.getState();
    const forzar = new Set(Object.keys(forzadas));
    const plan = planPedido(pedibles, store.entradas, { lotesCorriendo: lotes.length, forzar });
    if (!plan) return;
    const aPedir = plan.laminas;
    const primero = Object.keys(store.entradas).length === 0;
    const id = setTimeout(() => {
      const porId = new Map(pedibles.map((p) => [p.id, p]));
      const pedidas = aPedir.map((l) => porId.get(l.id)).filter((p): p is LaminaPedible => !!p);
      const claves = Object.fromEntries(pedidas.map((p) => [p.id, p.clave]));
      const s = useMiniaturasLoteStore.getState();
      s.pedir(pedidas);
      apiGraficosMiniaturas({
        slides: pedidas.map((p) => p.slide),
        config: buildGraficosConfigFromStore(),
        preview_quality: "quick",
        reemplazar: plan.reemplazar,
        ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
      }).then(
        (r) => useMiniaturasLoteStore.getState().iniciarLote({ loteId: r.lote_id, jobId: r.job_id, claves }, { reemplazo: plan.reemplazar }),
        (e: unknown) => useMiniaturasLoteStore.getState().fallar(claves, e instanceof Error ? e.message : String(e)),
      );
      // Un lote que no reemplaza (láminas recién vistas) no cancela nada: basta la espera corta para agrupar el scroll.
    }, forzar.size && aPedir.every((l) => forzar.has(l.id)) ? 0 : primero || !plan.reemplazar ? ESPERA_PRIMER_LOTE_MS : ESPERA_EDICION_MS);
    return () => clearTimeout(id);
  }, [habilitada, enVuelo, pedibles, lotes, forzadas, scope]);

  // Un poll por lote vivo: cada lámina se pinta en cuanto llega. Los polls ya iniciados no se reinician al sumarse otro
  // lote (perderían su cadencia); se paran al salir el lote del store (terminado, fallido o reemplazado).
  const polls = useRef(new Map<string, () => void>());
  useEffect(() => {
    const src = (url: string) => miniaturaSrc({ url });
    const vivos = new Set(lotes.map((l) => l.loteId));
    for (const [id, parar] of polls.current) if (!vivos.has(id)) { parar(); polls.current.delete(id); }
    for (const id of vivos) {
      if (polls.current.has(id)) continue;
      polls.current.set(id, iniciarPollLote(id, (u) => {
        const s = useMiniaturasLoteStore.getState();
        if (u.tipo === "estado") s.aplicarLote(u.lote, src);
        else {
          const propio = s.lotes.find((l) => l.loteId === id);
          if (propio) s.fallar(propio.claves, u.mensaje, id);
        }
      }, { leer: (loteId) => apiGraficosMiniaturasLote(loteId) }));
    }
  }, [lotes]);

  // Salir de Láminas cancela los lotes (cola cancelable); lo ya dibujado queda en la caché del backend y en la tira.
  useEffect(() => {
    const activos = polls.current;
    return () => {
      for (const parar of activos.values()) parar();
      activos.clear();
      for (const jobId of useMiniaturasLoteStore.getState().abandonarLotes()) void apiJobCancel(jobId).catch(() => undefined);
    };
  }, []);

  // Otra sesión (otro proyecto): las imágenes llevan el sid viejo y las claves no valen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reiniciar = () => useMiniaturasLoteStore.getState().reiniciar();
    window.addEventListener("pulso:session-changed", reiniciar);
    return () => window.removeEventListener("pulso:session-changed", reiniciar);
  }, []);

  const clavePorId = useMemo(() => Object.fromEntries(pedibles.map((p) => [p.id, p.clave])), [pedibles]);
  return {
    entradas,
    /** Clave vigente de cada lámina: una entrada con otra clave está desactualizada. */
    clavePorId,
    avance: avanceLote(entradas, vigente),
    habilitada,
    reintentar: useMiniaturasLoteStore.getState().reintentar,
  };
}
