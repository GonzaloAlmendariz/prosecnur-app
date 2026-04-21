import { useEffect, useState } from "react";
import { apiGraficosPresetsMetadata, PresetsRegistry, PresetMetadata } from "../../api/client";

// Mismo patrón que `useGraficosRegistry`: cache a nivel módulo porque
// el catálogo es inmutable para una versión dada del backend. Todos los
// consumidores comparten una única request.

let cache: PresetsRegistry | null = null;
let pending: Promise<PresetsRegistry> | null = null;

export function usePresetsMetadata(): {
  presets: PresetMetadata[];
  presetsByName: Record<string, PresetMetadata>;
  loading: boolean;
  error: string;
} {
  const [data, setData] = useState<PresetsRegistry | null>(cache);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (cache) return;
    if (!pending) {
      pending = apiGraficosPresetsMetadata().then((r) => {
        cache = r;
        pending = null;
        return r;
      });
    }
    pending
      .then((r) => {
        setData(r);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, []);

  const presets = data?.presets ?? [];
  const presetsByName: Record<string, PresetMetadata> = {};
  for (const p of presets) presetsByName[p.name] = p;

  return { presets, presetsByName, loading, error };
}

export function invalidatePresetsMetadata() {
  cache = null;
  pending = null;
}
