import { useCallback, useEffect, useState } from "react";
import { apiGraficosPresetsDefaultsGet } from "../../api/client";

// Hook: trae los "defaults efectivos" de los presets — lo que viene en
// factory (.PRESETS_DEFAULT_PULSO) o lo que el analista guardó como su
// default via POST /presets-defaults. Lo usamos para:
//  (1) decidir si un preset está "modificado" (value actual != default)
//  (2) alimentar el modal "Gestionar defaults"
//
// Se refresca al cambiar de sesión (otro demo) — útil porque los
// defaults del usuario pueden ser por-sesión.

export type PresetsDefaultsState = {
  presets: Record<string, Record<string, unknown>>;
  esCustom: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

export function usePresetsDefaults(): PresetsDefaultsState {
  const [presets, setPresets] = useState<Record<string, Record<string, unknown>>>({});
  const [esCustom, setEsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGraficosPresetsDefaultsGet();
      setPresets(r.presets || {});
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
    function onSessionChanged() { void refresh(); }
    window.addEventListener("pulso:session-changed", onSessionChanged);
    // El evento custom para cuando se "guarda como default" desde el modal.
    window.addEventListener("pulso:presets-defaults-changed", onSessionChanged);
    return () => {
      window.removeEventListener("pulso:session-changed", onSessionChanged);
      window.removeEventListener("pulso:presets-defaults-changed", onSessionChanged);
    };
  }, [refresh]);

  return { presets, esCustom, loading, error, refresh };
}

// Compara shallow-mente dos records de args del preset. Los valores son
// primitivos (number, string, bool) o arrays/objects (colores_series,
// textos_negrita). Para simplicidad usamos JSON.stringify — suficiente
// mientras los args sigan siendo JSON-serializable (lo son por contrato).
export function presetArgsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}
