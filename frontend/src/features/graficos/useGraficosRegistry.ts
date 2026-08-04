import { useEffect, useMemo, useState } from "react";
import { apiGraficosRegistry, Registry, SlideMetadata, GraficadorMetadata } from "../../api/client";
import { getSession } from "../../api/core";
import { normalizeGraficosRegistry } from "./metadataSanitizers";

// Hook que carga el registry de slides + graficadores.
//
// El catálogo es estable dentro de una sesión: lo único que depende del
// proyecto es la disponibilidad del graficador territorial. Antes solo se
// deduplicaban las requests concurrentes, así que cada montaje de cualquiera
// de los consumidores del hook —y son más de diez: picker, formulario,
// inspector, timeline, canvas, validador— volvía a pedir 60 KB al backend.
// Plumber atiende en un solo hilo, de modo que esa request se encolaba detrás
// del trabajo pesado del plan (previews, cobertura, presets) y el diálogo
// "Elegir visual" se quedaba en "Cargando catálogo…" el tiempo de la cola,
// no el del catálogo.
//
// Ahora el catálogo se cachea por sesión y se revalida en segundo plano con
// un enfriamiento: la superficie abre con datos y se corrige sola si el
// proyecto gana capacidades (Hojas de Ruta + Monitoreo territorial) sin
// volver a bloquear la vista.
const REVALIDATE_COOLDOWN_MS = 60_000;

type CacheEntry = { sid: string | null; registry: Registry; at: number };

let cache: CacheEntry | null = null;
let pending: Promise<Registry> | null = null;
let pendingSid: string | null = null;

function cachedRegistry(sid: string | null): Registry | null {
  if (!cache || cache.sid !== sid) return null;
  return cache.registry;
}

function cacheIsFresh(sid: string | null): boolean {
  return !!cache && cache.sid === sid && Date.now() - cache.at < REVALIDATE_COOLDOWN_MS;
}

function requestRegistry(sid: string | null): Promise<Registry> {
  if (pending && pendingSid === sid) return pending;
  const request = apiGraficosRegistry().then((response) => {
    const normalized = normalizeGraficosRegistry(response);
    const previous = cachedRegistry(sid);
    // Conservar la referencia anterior cuando el catálogo no cambió evita que
    // una revalidación silenciosa re-renderice a todos los consumidores.
    const registry = previous && JSON.stringify(previous) === JSON.stringify(normalized)
      ? previous
      : normalized;
    cache = { sid, registry, at: Date.now() };
    return registry;
  });
  pending = request;
  pendingSid = sid;
  const release = () => {
    if (pending === request) {
      pending = null;
      pendingSid = null;
    }
  };
  request.then(release, release);
  return request;
}

// Calienta el catálogo desde el warmup del módulo para que la primera apertura
// del picker no pague la request (ni el arranque perezoso del backend).
export function prefetchGraficosRegistry(): Promise<Registry> {
  return requestRegistry(getSession());
}

export function useGraficosRegistry(): {
  registry: Registry | null;
  slidesById: Record<string, SlideMetadata>;
  graficadoresById: Record<string, GraficadorMetadata>;
  loading: boolean;
  error: string;
} {
  const sid = getSession();
  const [registry, setRegistry] = useState<Registry | null>(() => cachedRegistry(sid));
  const [loading, setLoading] = useState<boolean>(() => cachedRegistry(sid) === null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const cached = cachedRegistry(sid);
    setError("");
    if (cached) {
      setRegistry(cached);
      setLoading(false);
      if (cacheIsFresh(sid)) return () => { alive = false; };
    } else {
      setLoading(true);
    }
    requestRegistry(sid)
      .then((r) => {
        if (!alive) return;
        setRegistry(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        // Una revalidación fallida no degrada una vista que ya tiene catálogo.
        if (cachedRegistry(sid)) return;
        setError((e as Error).message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sid]);

  // Pre-calculamos maps name → metadata para lookups O(1) en los
  // renderers de GraficadorForm y SlideEditor.
  const { slidesById, graficadoresById } = useMemo(() => {
    const slides: Record<string, SlideMetadata> = {};
    const graficadores: Record<string, GraficadorMetadata> = {};
    if (registry) {
      for (const s of registry.slides) slides[s.name] = s;
      for (const g of registry.graficadores) graficadores[g.name] = g;
    }
    return { slidesById: slides, graficadoresById: graficadores };
  }, [registry]);

  return { registry, slidesById, graficadoresById, loading, error };
}

export function invalidateRegistry() {
  cache = null;
  pending = null;
  pendingSid = null;
}
