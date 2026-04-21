import { useCallback, useEffect, useState } from "react";
import {
  apiGraficosOverridesDefaultsGet,
  OverrideDefaultEntry,
} from "../../api/client";

// Hook paralelo a `usePresetsDefaults`: trae los "overrides por defecto"
// efectivos — los que el usuario guardó via POST /overrides-defaults, o
// los de fábrica (.OVERRIDES_DEFAULT_PULSO) si nunca guardó.
//
// Lo consume `DefaultsModal > OverridesDefaultsEditor` — el analista
// edita la lista en un draft local y guarda con apiGraficos
// OverridesDefaultsSave. Otros consumidores potenciales:
//  - NuevoEstudio / ResetPlan (pre-cargar overridesReusables al crear
//    un estudio nuevo).

export type OverridesDefaultsState = {
  overrides: OverrideDefaultEntry[];
  esCustom: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

export function useOverridesDefaults(): OverridesDefaultsState {
  const [overrides, setOverrides] = useState<OverrideDefaultEntry[]>([]);
  const [esCustom, setEsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGraficosOverridesDefaultsGet();
      setOverrides(r.overrides || []);
      setEsCustom(!!r.es_custom);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    function onChanged() { void refresh(); }
    window.addEventListener("pulso:session-changed", onChanged);
    window.addEventListener("pulso:overrides-defaults-changed", onChanged);
    return () => {
      window.removeEventListener("pulso:session-changed", onChanged);
      window.removeEventListener("pulso:overrides-defaults-changed", onChanged);
    };
  }, [refresh]);

  return { overrides, esCustom, loading, error, refresh };
}
