import { useEffect, useState } from "react";
import { apiGraficosRegistry, Registry, SlideMetadata, GraficadorMetadata } from "../../api/client";

// Hook que carga y cachea el registry de slides + graficadores. Los
// datos son inmutables para una misma versión de prosecnur, así que
// los cacheamos a nivel módulo: una sola request por tab, compartida
// entre todos los componentes que la necesiten.

let cache: Registry | null = null;
let pending: Promise<Registry> | null = null;

export function useGraficosRegistry(): {
  registry: Registry | null;
  slidesById: Record<string, SlideMetadata>;
  graficadoresById: Record<string, GraficadorMetadata>;
  loading: boolean;
  error: string;
} {
  const [registry, setRegistry] = useState<Registry | null>(cache);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (cache) return;
    if (!pending) {
      pending = apiGraficosRegistry().then((r) => {
        cache = r;
        pending = null;
        return r;
      });
    }
    pending
      .then((r) => {
        setRegistry(r);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
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
  cache = null;
  pending = null;
}
