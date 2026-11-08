// Orquesta la miniatura real de la tarjeta enfocada del selector de láminas (o de las dos de «Comparar»): pide un lote
// con `POST /api/graficos/miniaturas` (siempre `reemplazar = false`, para no cancelar los lotes de la tira ni del mazo;
// el backend cancela TODOS los de la sesión ante un `true`) y pollea su estado. Mientras carga, el hueco pinta el glifo.
// Al cerrar el selector se sueltan y cancelan sus jobs. Reglas en modeloMiniaturasSelector.ts; estado en
// miniaturasSelectorStore.ts. Mismo patrón que mazoResumen/useMiniaturasMazo.ts.

import { useEffect, useMemo, useRef } from "react";
import { apiGraficosMiniaturas, apiGraficosMiniaturasLote, miniaturaSrc } from "../../../../api/graficosMiniaturas";
import { apiJobCancel } from "../../../../api/jobs";
import { useSession } from "../../../../lib/SessionContext";
import { buildGraficosConfigFromStore } from "../../configSnapshot";
import { clavePreview } from "../../previewLaminaCoordinador";
import type { GraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { iniciarPollLote } from "../miniaturas/pollLote";
import { ESPERA_PRIMER_LOTE_MS } from "../miniaturas/useMiniaturasLote";
import type { EstadoInventario } from "./fichaDatos";
import { useMiniaturasSelectorStore } from "./miniaturasSelectorStore";
import {
  laminasDelSelector, miniaturaDeEntrada, notasDelSelector, planSelector,
  type FuenteSelector, type LaminaDelSelector, type MiniaturaSelector,
} from "./modeloMiniaturasSelector";
import type { EstudioDelSelector, OpcionLamina } from "./opcionesLamina";

type Entrada = {
  /** Las tarjetas a la vista que piden (opcionesQuePiden): la enfocada o las dos comparadas. */
  opciones: readonly OpcionLamina[];
  inventario: EstadoInventario;
  estudio: EstudioDelSelector;
  scope: GraficosReportScope;
  /** El selector está abierto. */
  activo: boolean;
  /** Las preguntas de cada base (useVariables): la muestra de una tarjeta sin preguntas de partida (R5-1). */
  fuentes?: readonly FuenteSelector[];
};

const SIN_FUENTES: readonly FuenteSelector[] = [];

/** Firma barata de las preguntas: qué bases y qué variables, con su tipo (la muestra sólo depende de eso). */
const firmaFuentes = (fuentes: readonly FuenteSelector[]): string =>
  fuentes.map((f) => `${f.name}:${f.variables.map((v) => `${v.name}/${v.tipo}/${v.choices?.length ?? 0}`).join(",")}`).join("|");

function cancelarLotes(): void {
  for (const jobId of useMiniaturasSelectorStore.getState().abandonarLotes()) void apiJobCancel(jobId).catch(() => undefined);
}

/** El hueco de cada tarjeta pedida (por opción); las que no piden no tienen entrada y pintan su glifo. */
export function useMiniaturasSelector({ opciones, inventario, estudio, scope, activo, fuentes = SIN_FUENTES }: Entrada): Partial<Record<OpcionLamina, MiniaturaSelector>> {
  const { state } = useSession();
  const habilitada = activo && (!!state?.analitica_prep_ok || scope === "consolidated");
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const overrides = usePlanStore((s) => s.overridesReusables);
  const entradas = useMiniaturasSelectorStore((s) => s.entradas);
  const lotes = useMiniaturasSelectorStore((s) => s.lotes);
  const enVuelo = useMiniaturasSelectorStore((s) => s.enVuelo);

  // La firma por contenido deja el mismo arreglo mientras no cambien las tarjetas, el estudio ni el estilo.
  const global = useMemo(() => clavePreview({ presets, paletas, overrides, scope }), [presets, paletas, overrides, scope]);
  const firma = `${global}#${clavePreview({ opciones, inventario, estudio })}#${firmaFuentes(fuentes)}`;
  const memo = useRef<{ firma: string; laminas: LaminaDelSelector[]; notas: Partial<Record<OpcionLamina, string>> } | null>(null);
  if (memo.current?.firma !== firma) {
    memo.current = {
      firma,
      laminas: laminasDelSelector(opciones, inventario, estudio, global, fuentes),
      notas: notasDelSelector(opciones, inventario, estudio, fuentes),
    };
  }
  const { laminas, notas } = memo.current;

  useEffect(() => {
    if (!habilitada || enVuelo || !laminas.length) return;
    const aPedir = planSelector(laminas, useMiniaturasSelectorStore.getState().entradas, lotes.length);
    if (!aPedir) return;
    // Recorrer la galería con las flechas cambia la enfocada a cada paso: se espera a que se asiente.
    const id = setTimeout(() => {
      const porId = new Map(laminas.map((l) => [l.id, l]));
      const pedidas = aPedir.map((l) => porId.get(l.id)).filter((l): l is LaminaDelSelector => !!l);
      const claves = Object.fromEntries(pedidas.map((p) => [p.id, p.clave]));
      useMiniaturasSelectorStore.getState().pedir(pedidas);
      apiGraficosMiniaturas({
        slides: pedidas.map((p) => p.slide),
        config: buildGraficosConfigFromStore(),
        preview_quality: "quick",
        reemplazar: false,
        ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
      }).then(
        (r) => useMiniaturasSelectorStore.getState().iniciarLote({ loteId: r.lote_id, jobId: r.job_id, claves }),
        (e: unknown) => useMiniaturasSelectorStore.getState().fallar(claves, e instanceof Error ? e.message : String(e)),
      );
    }, ESPERA_PRIMER_LOTE_MS);
    return () => clearTimeout(id);
  }, [habilitada, enVuelo, laminas, lotes, scope]);

  const polls = useRef(new Map<string, () => void>());
  useEffect(() => {
    const src = (url: string) => miniaturaSrc({ url });
    const vivos = new Set(lotes.map((l) => l.loteId));
    for (const [id, parar] of polls.current) if (!vivos.has(id)) { parar(); polls.current.delete(id); }
    for (const id of vivos) {
      if (polls.current.has(id)) continue;
      polls.current.set(id, iniciarPollLote(id, (u) => {
        const s = useMiniaturasSelectorStore.getState();
        if (u.tipo === "estado") s.aplicarLote(u.lote, src);
        else {
          const propio = s.lotes.find((l) => l.loteId === id);
          if (propio) s.fallar(propio.claves, u.mensaje, id);
        }
      }, { leer: (loteId) => apiGraficosMiniaturasLote(loteId) }));
    }
  }, [lotes]);

  // Cerrar el selector suelta y cancela sus lotes; lo ya dibujado queda en la caché del backend.
  useEffect(() => {
    if (habilitada) return;
    for (const parar of polls.current.values()) parar();
    polls.current.clear();
    cancelarLotes();
  }, [habilitada]);
  useEffect(() => {
    const activos = polls.current;
    return () => {
      for (const parar of activos.values()) parar();
      activos.clear();
      cancelarLotes();
    };
  }, []);

  // Otra sesión: las imágenes llevan el sid viejo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reiniciar = () => useMiniaturasSelectorStore.getState().reiniciar();
    window.addEventListener("pulso:session-changed", reiniciar);
    return () => window.removeEventListener("pulso:session-changed", reiniciar);
  }, []);

  // Las que no piden por estar incompletas llevan su línea «Sin vista previa: …» junto al glifo.
  return useMemo(() => ({
    ...Object.fromEntries(Object.entries(notas).map(([op, nota]) => [op, { src: null, error: nota ?? null }])),
    ...Object.fromEntries(laminas.map((l) => [l.opcion, miniaturaDeEntrada(entradas[l.id])])),
  }), [laminas, notas, entradas]);
}
