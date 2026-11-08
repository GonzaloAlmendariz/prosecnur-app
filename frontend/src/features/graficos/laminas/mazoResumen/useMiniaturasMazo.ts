// Orquesta las miniaturas reales de las tarjetas del mazo: pide un lote con `POST /api/graficos/miniaturas` (siempre
// `reemplazar = false`: la tira sigue con lo suyo) y pollea su estado para pintar cada tarjeta conforme llega. Mientras
// tanto, la tarjeta muestra el glifo de su tipo. Reglas en modeloMiniaturasMazo.ts y estado en miniaturasMazoStore.ts.

import { useEffect, useMemo, useRef } from "react";
import { apiGraficosMiniaturas, apiGraficosMiniaturasLote, miniaturaSrc } from "../../../../api/graficosMiniaturas";
import { apiJobCancel } from "../../../../api/jobs";
import { useSession } from "../../../../lib/SessionContext";
import { buildGraficosConfigFromStore } from "../../configSnapshot";
import { clavePreview } from "../../previewLaminaCoordinador";
import { usePlanStore } from "../../store";
import { iniciarPollLote } from "../miniaturas/pollLote";
import { ESPERA_EDICION_MS, ESPERA_PRIMER_LOTE_MS } from "../miniaturas/useMiniaturasLote";
import { useMiniaturasMazoStore } from "./miniaturasMazoStore";
import { imagenDeTarjeta, laminasConMiniatura, planMazo, type LaminaDelMazo } from "./modeloMiniaturasMazo";
import type { PropuestaMazo } from "./modeloMazo";

/** La imagen de cada propuesta (por id de propuesta); sin entrada, la tarjeta pinta su glifo. */
export function useMiniaturasMazo(propuestas: readonly PropuestaMazo[], scope: "active" | "consolidated", activo: boolean): Record<string, string | null> {
  const { state } = useSession();
  const habilitada = activo && (!!state?.analitica_prep_ok || scope === "consolidated");
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const overrides = usePlanStore((s) => s.overridesReusables);
  const entradas = useMiniaturasMazoStore((s) => s.entradas);
  const lotes = useMiniaturasMazoStore((s) => s.lotes);
  const enVuelo = useMiniaturasMazoStore((s) => s.enVuelo);

  // Misma clave que la tira: lámina + estilo global + alcance. Las propuestas se rehacen en cada render del mazo; la
  // firma por contenido deja el mismo arreglo mientras no cambien, para no relanzar el pedido en cada render.
  const global = useMemo(() => clavePreview({ presets, paletas, overrides, scope }), [presets, paletas, overrides, scope]);
  const firma = `${global}#${clavePreview(propuestas)}`;
  const memo = useRef<{ firma: string; laminas: LaminaDelMazo[] } | null>(null);
  if (memo.current?.firma !== firma) memo.current = { firma, laminas: laminasConMiniatura(propuestas, global) };
  const laminas = memo.current.laminas;

  useEffect(() => {
    if (!habilitada || enVuelo || !laminas.length) return;
    const store = useMiniaturasMazoStore.getState();
    const aPedir = planMazo(laminas, store.entradas, lotes.length);
    if (!aPedir) return;
    const primero = aPedir.every((l) => !store.entradas[l.id]);
    const id = setTimeout(() => {
      const porId = new Map(laminas.map((l) => [l.id, l]));
      const pedidas = aPedir.map((l) => porId.get(l.id)).filter((l): l is LaminaDelMazo => !!l);
      const claves = Object.fromEntries(pedidas.map((p) => [p.id, p.clave]));
      useMiniaturasMazoStore.getState().pedir(pedidas);
      apiGraficosMiniaturas({
        slides: pedidas.map((p) => p.slide),
        config: buildGraficosConfigFromStore(),
        preview_quality: "quick",
        reemplazar: false,
        ...(scope === "consolidated" ? { scope: "consolidated" as const } : {}),
      }).then(
        (r) => useMiniaturasMazoStore.getState().iniciarLote({ loteId: r.lote_id, jobId: r.job_id, claves }),
        (e: unknown) => useMiniaturasMazoStore.getState().fallar(claves, e instanceof Error ? e.message : String(e)),
      );
    }, primero ? ESPERA_PRIMER_LOTE_MS : ESPERA_EDICION_MS);
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
        const s = useMiniaturasMazoStore.getState();
        if (u.tipo === "estado") s.aplicarLote(u.lote, src);
        else {
          const propio = s.lotes.find((l) => l.loteId === id);
          if (propio) s.fallar(propio.claves, u.mensaje, id);
        }
      }, { leer: (loteId) => apiGraficosMiniaturasLote(loteId) }));
    }
  }, [lotes]);

  // Cerrar el mazo suelta y cancela sus lotes; lo ya dibujado queda en la caché del backend.
  useEffect(() => {
    if (habilitada) return;
    for (const parar of polls.current.values()) parar();
    polls.current.clear();
    for (const jobId of useMiniaturasMazoStore.getState().abandonarLotes()) void apiJobCancel(jobId).catch(() => undefined);
  }, [habilitada]);
  useEffect(() => {
    const activos = polls.current;
    return () => {
      for (const parar of activos.values()) parar();
      activos.clear();
      for (const jobId of useMiniaturasMazoStore.getState().abandonarLotes()) void apiJobCancel(jobId).catch(() => undefined);
    };
  }, []);

  // Otra sesión: las imágenes llevan el sid viejo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reiniciar = () => useMiniaturasMazoStore.getState().reiniciar();
    window.addEventListener("pulso:session-changed", reiniciar);
    return () => window.removeEventListener("pulso:session-changed", reiniciar);
  }, []);

  return useMemo(
    () => Object.fromEntries(laminas.map((l) => [l.propuesta, imagenDeTarjeta(entradas[l.id])])),
    [laminas, entradas],
  );
}
