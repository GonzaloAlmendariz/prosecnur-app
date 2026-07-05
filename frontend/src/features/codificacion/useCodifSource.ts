import { useCallback, useEffect, useState } from "react";
import {
  apiCodifSourceGet,
  apiCodifSourceSet,
  apiEstudioGet,
  CodifSourceState,
  EstudioPayload,
} from "../../api/client";

// Hook de "base activa para codificación". Lee del backend al montar +
// escucha `pulso:session-changed` para rehidratar al cambiar de demo.
// Expone `setActive` que POSTea el cambio al backend y dispara un evento
// local `pulso:codif-source-changed` para que los caches internos de la
// página (listas de columnas, preguntas abiertas, familias, etc.) se
// invaliden y recarguen con el scope nuevo.

export function useCodifSource(): {
  active: string | null;
  options: string[];
  labels: Record<string, string>;
  processingMode: string | null;
  loading: boolean;
  error: string;
  labelFor: (source: string | null | undefined) => string;
  setActive: (source: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<CodifSourceState>({ active: null, options: [] });
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, estudio] = await Promise.all([
        apiCodifSourceGet(),
        apiEstudioGet().catch(() => null),
      ]);
      setState(s);
      setLabels(buildCodifSourceLabels(estudio));
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
    window.addEventListener("pulso:active-base-changed", onSessionChanged);
    return () => {
      window.removeEventListener("pulso:session-changed", onSessionChanged);
      window.removeEventListener("pulso:active-base-changed", onSessionChanged);
    };
  }, [refresh]);

  const setActive = useCallback(async (source: string) => {
    if (source === state.active) return;
    setLoading(true);
    try {
      const r = await apiCodifSourceSet(source);
      setState((prev) => ({ ...prev, ...r, active: r.active }));
      setError("");
      // Dispara evento para que hooks de codificación con cache se
      // invaliden (preguntas abiertas, columnas, familias draft, etc.).
      window.dispatchEvent(new CustomEvent("pulso:codif-source-changed", {
        detail: { source: r.active },
      }));
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: r.active, processing_mode: r.processing_mode },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [state.active]);

  const labelFor = useCallback((source: string | null | undefined) => {
    if (!source || source === "default") return "Base única";
    return labels[source] || source;
  }, [labels]);

  return {
    active: state.active,
    options: state.options,
    labels,
    processingMode: state.processing_mode ?? null,
    loading,
    error,
    labelFor,
    setActive,
    refresh,
  };
}

function buildCodifSourceLabels(estudio: EstudioPayload | null): Record<string, string> {
  if (!estudio?.bases) return {};
  return Object.fromEntries(Object.entries(estudio.bases).map(([name, base]) => {
    const label = [base.source_alias, base.source_title, name]
      .map((value) => String(value ?? "").trim())
      .find(Boolean) || name;
    return [name, label];
  }));
}
