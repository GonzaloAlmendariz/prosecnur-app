import { useCallback, useEffect, useState } from "react";
import { apiCodifSourceGet, apiCodifSourceSet, CodifSourceState } from "../../api/client";

// Hook de "base activa para codificación". Lee del backend al montar +
// escucha `pulso:session-changed` para rehidratar al cambiar de demo.
// Expone `setActive` que POSTea el cambio al backend y dispara un evento
// local `pulso:codif-source-changed` para que los caches internos de la
// página (listas de columnas, preguntas abiertas, familias, etc.) se
// invaliden y recarguen con el scope nuevo.

export function useCodifSource(): {
  active: string | null;
  options: string[];
  loading: boolean;
  error: string;
  setActive: (source: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<CodifSourceState>({ active: null, options: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await apiCodifSourceGet();
      setState(s);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onSessionChanged() { void refresh(); }
    window.addEventListener("pulso:session-changed", onSessionChanged);
    return () => window.removeEventListener("pulso:session-changed", onSessionChanged);
  }, [refresh]);

  const setActive = useCallback(async (source: string) => {
    if (source === state.active) return;
    setLoading(true);
    try {
      const r = await apiCodifSourceSet(source);
      setState((prev) => ({ ...prev, active: r.active }));
      setError("");
      // Dispara evento para que hooks de codificación con cache se
      // invaliden (preguntas abiertas, columnas, familias draft, etc.).
      window.dispatchEvent(new CustomEvent("pulso:codif-source-changed", {
        detail: { source: r.active },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [state.active]);

  return { active: state.active, options: state.options, loading, error, setActive, refresh };
}
