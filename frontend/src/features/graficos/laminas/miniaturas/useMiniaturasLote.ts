// Orquesta las miniaturas reales de la tira (F6 §5.3; contrato docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md §6):
// pide un lote con `POST /api/graficos/miniaturas` (estado vivo del editor, `reemplazar = true`) y pollea
// `GET /api/graficos/miniaturas/<lote_id>` para pintar cada lámina conforme llega. Nunca un render masivo síncrono.
// Al editar una lámina sólo vuelve a pedirse ésa (más las que el lote reemplazado dejó pendientes); el backend decide
// por huella si re-renderiza. La lógica vive en `loteMiniaturas.ts` (pura) y el estado en `miniaturasStore.ts`.

import { useEffect, useMemo } from "react";
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
import { avanceLote, laminasAPedir, type LaminaClave } from "./loteMiniaturas";
import { useMiniaturasLoteStore } from "./miniaturasStore";
import { iniciarPollLote } from "./pollLote";

/** Primer lote casi de inmediato; tras una edición se espera a que el analista deje de teclear. */
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
    const aPedir = laminasAPedir(pedibles, store.entradas, { loteCorriendo: !!vigente, forzar });
    if (!aPedir.length) return;
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
        reemplazar: true,
        ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
      }).then(
        (r) => useMiniaturasLoteStore.getState().iniciarLote({ loteId: r.lote_id, jobId: r.job_id, claves }),
        (e: unknown) => useMiniaturasLoteStore.getState().fallar(claves, e instanceof Error ? e.message : String(e)),
      );
    }, primero ? ESPERA_PRIMER_LOTE_MS : forzar.size && aPedir.every((l) => forzar.has(l.id)) ? 0 : ESPERA_EDICION_MS);
    return () => clearTimeout(id);
  }, [habilitada, enVuelo, pedibles, vigente, forzadas, scope]);

  // Poll del lote vigente: cada lámina se pinta en cuanto llega.
  const loteId = vigente?.loteId ?? null;
  useEffect(() => {
    if (!loteId) return;
    const src = (url: string) => miniaturaSrc({ url });
    return iniciarPollLote(loteId, (u) => {
      const s = useMiniaturasLoteStore.getState();
      if (u.tipo === "estado") s.aplicarLote(u.lote, src);
      else if (s.vigente?.loteId === loteId) s.fallar(s.vigente.claves, u.mensaje);
    }, { leer: (id) => apiGraficosMiniaturasLote(id) });
  }, [loteId]);

  // Salir de Láminas cancela el lote (cola cancelable); lo ya dibujado queda en la caché del backend y en la tira.
  useEffect(() => () => {
    const s = useMiniaturasLoteStore.getState();
    const jobId = s.abandonarLote();
    if (jobId) void apiJobCancel(jobId).catch(() => undefined);
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
