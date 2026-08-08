import { useEffect, useMemo, useState } from "react";
import { apiGraficosRegistry, Registry, SlideMetadata, GraficadorMetadata } from "../../api/client";
import { getSession } from "../../api/core";
import { useOptionalSession } from "../../lib/SessionContext";
import * as logSink from "../../lib/logSink";
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
const PUBLIC_REGISTRY_ERROR =
  "No pudimos consultar el catálogo de Gráficos. Revisa la conexión y recarga la aplicación para reintentar.";

type CacheEntry = { sid: string | null; registry: Registry; at: number };

export type GraficosRegistrySnapshot = {
  sid: string | null;
  registry: Registry | null;
  loading: boolean;
  error: string;
};

export type GraficosRegistryMaps = {
  slidesById: Record<string, SlideMetadata>;
  graficadoresById: Record<string, GraficadorMetadata>;
};

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
  const request = apiGraficosRegistry()
    .then((response) => {
      const normalized = normalizeGraficosRegistry(response);
      const previous = cachedRegistry(sid);
      // Conservar la referencia anterior cuando el catálogo no cambió evita que
      // una revalidación silenciosa re-renderice a todos los consumidores.
      const registry = previous && JSON.stringify(previous) === JSON.stringify(normalized)
        ? previous
        : normalized;
      cache = { sid, registry, at: Date.now() };
      return registry;
    })
    .catch((cause: unknown) => {
      logSink.note(graficosRegistryErrorLogLine(cause), "error");
      throw cause;
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

export function publicGraficosRegistryError(_cause: unknown): string {
  return PUBLIC_REGISTRY_ERROR;
}

export function graficosRegistryErrorLogLine(cause: unknown): string {
  const type = cause === null ? "null" : typeof cause;
  let name = diagnosticName(cause, type);
  let code = "";

  try {
    if ((typeof cause === "object" && cause !== null) || typeof cause === "function") {
      const candidate = (cause as Record<string, unknown>).code;
      if (typeof candidate === "string" && /^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(candidate)) {
        code = candidate;
      }
    }
  } catch {
    name = "Unknown";
  }

  return `graficos_registry_error type=${type} name=${name}${code ? ` code=${code}` : ""}`;
}

function diagnosticName(cause: unknown, type: string): string {
  try {
    if (cause instanceof Error) {
      return /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/.test(cause.name) ? cause.name : "Error";
    }
    if (Array.isArray(cause)) return "Array";
  } catch {
    return "Unknown";
  }

  const names: Record<string, string> = {
    bigint: "BigInt",
    boolean: "Boolean",
    function: "Function",
    null: "Null",
    number: "Number",
    object: "Object",
    string: "String",
    symbol: "Symbol",
    undefined: "Undefined",
  };
  return names[type] ?? "Unknown";
}

export function visibleGraficosRegistrySnapshot(
  sid: string | null,
  snapshot: GraficosRegistrySnapshot,
): GraficosRegistrySnapshot {
  if (snapshot.sid === sid) return snapshot;
  return { sid, registry: null, loading: true, error: "" };
}

export function graficosRegistryMaps(registry: Registry | null): GraficosRegistryMaps {
  const slidesById: Record<string, SlideMetadata> = {};
  const graficadoresById: Record<string, GraficadorMetadata> = {};
  if (registry) {
    for (const slide of registry.slides) slidesById[slide.name] = slide;
    for (const graficador of registry.graficadores) {
      graficadoresById[graficador.name] = graficador;
    }
  }
  return { slidesById, graficadoresById };
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
  const optionalSession = useOptionalSession();
  const sid = optionalSession ? optionalSession.sessionId || null : getSession();
  const [snapshot, setSnapshot] = useState<GraficosRegistrySnapshot>(() => {
    const initialRegistry = cachedRegistry(sid);
    return {
      sid,
      registry: initialRegistry,
      loading: initialRegistry === null,
      error: "",
    };
  });
  const visibleSnapshot = visibleGraficosRegistrySnapshot(sid, snapshot);

  useEffect(() => {
    let alive = true;
    const cached = cachedRegistry(sid);
    if (cached) {
      setSnapshot({ sid, registry: cached, loading: false, error: "" });
      if (cacheIsFresh(sid)) return () => { alive = false; };
    } else {
      setSnapshot({ sid, registry: null, loading: true, error: "" });
    }
    requestRegistry(sid)
      .then((r) => {
        if (!alive) return;
        setSnapshot({ sid, registry: r, loading: false, error: "" });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // Una revalidación fallida no degrada una vista que ya tiene catálogo.
        const matchingCached = cachedRegistry(sid) ?? cached;
        if (matchingCached) {
          setSnapshot({ sid, registry: matchingCached, loading: false, error: "" });
          return;
        }
        setSnapshot({
          sid,
          registry: null,
          loading: false,
          error: publicGraficosRegistryError(e),
        });
      });
    return () => {
      alive = false;
    };
  }, [sid]);

  // Pre-calculamos maps name → metadata para lookups O(1) en los
  // renderers de GraficadorForm y SlideEditor.
  const { slidesById, graficadoresById } = useMemo(
    () => graficosRegistryMaps(visibleSnapshot.registry),
    [visibleSnapshot.registry],
  );

  return {
    registry: visibleSnapshot.registry,
    slidesById,
    graficadoresById,
    loading: visibleSnapshot.loading,
    error: visibleSnapshot.error,
  };
}

export function invalidateRegistry() {
  cache = null;
  pending = null;
  pendingSid = null;
}
