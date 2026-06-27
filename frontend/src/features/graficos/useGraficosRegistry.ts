import { useEffect, useState } from "react";
import { apiGraficosRegistry, Registry, SlideMetadata, GraficadorMetadata } from "../../api/client";
import { normalizeGraficosRegistry } from "./metadataSanitizers";

// Hook que carga el registry de slides + graficadores. El catálogo base es
// estable, pero algunas capacidades dependen del proyecto abierto (por ejemplo,
// mapas territoriales), así que solo deduplicamos requests concurrentes.
let pending: Promise<Registry> | null = null;

function requestRegistry() {
  if (!pending) {
    const request = apiGraficosRegistry().then((r) => normalizeGraficosRegistry(r));
    pending = request;
    request.then(() => {
      if (pending === request) pending = null;
    }, () => {
      if (pending === request) pending = null;
    });
  }
  return pending;
}

export function useGraficosRegistry(): {
  registry: Registry | null;
  slidesById: Record<string, SlideMetadata>;
  graficadoresById: Record<string, GraficadorMetadata>;
  loading: boolean;
  error: string;
} {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    requestRegistry()
      .then((r) => {
        if (!alive) return;
        setRegistry(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError((e as Error).message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Pre-calculamos maps name → metadata para lookups O(1) en los
  // renderers de GraficadorForm y SlideEditor.
  const slidesById: Record<string, SlideMetadata> = {};
  const graficadoresById: Record<string, GraficadorMetadata> = {};
  if (registry) {
    for (const s of registry.slides) slidesById[s.name] = s;
    for (const g of registry.graficadores) graficadoresById[g.name] = g;
  }

  return { registry, slidesById, graficadoresById, loading, error };
}

export function invalidateRegistry() {
  pending = null;
}
