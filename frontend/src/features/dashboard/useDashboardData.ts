import { useEffect, useState } from "react";
import {
  apiDashboardManifest,
  apiDashboardResumenKpis,
  apiDashboardResumenSeccion,
  apiDashboardSecciones,
  DashboardFiltro,
  DashboardKpisPayload,
  DashboardManifest,
  DashboardResumenPayload,
  DashboardSeccion,
  DashboardThemeDefault,
} from "../../api/client";

// Hooks granulares por endpoint. A diferencia del WIP descartado (un
// solo `useTableroBundle` con 1 fetch grande), aquí cada tab pide solo
// lo que necesita. Permite refresh independiente y evita re-fetch del
// payload de Resumen cuando el usuario está en otra tab.

export type ManifestState = {
  loading: boolean;
  error: string | null;
  manifest: DashboardManifest | null;
  themeDefault: DashboardThemeDefault | null;
  refresh: () => void;
};

export function useDashboardManifest(): ManifestState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<DashboardManifest | null>(null);
  const [themeDefault, setThemeDefault] = useState<DashboardThemeDefault | null>(null);
  const [k, setK] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardManifest()
      .then((r) => {
        if (cancelled) return;
        setManifest(r.manifest);
        setThemeDefault(r.theme_default);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [k]);

  return { loading, error, manifest, themeDefault, refresh: () => setK((x) => x + 1) };
}

export type SeccionesState = {
  loading: boolean;
  error: string | null;
  secciones: DashboardSeccion[];
  kpiVars: string[];
};

export function useDashboardSecciones(): SeccionesState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secciones, setSecciones] = useState<DashboardSeccion[]>([]);
  const [kpiVars, setKpiVars] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardSecciones()
      .then((r) => {
        if (cancelled) return;
        setSecciones(r.secciones);
        setKpiVars(r.kpi_vars);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, error, secciones, kpiVars };
}

export type ResumenSeccionState = {
  loading: boolean;
  error: string | null;
  payload: DashboardResumenPayload | null;
};

export function useResumenSeccion(
  seccion: string | null,
  filtros: DashboardFiltro[],
): ResumenSeccionState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardResumenPayload | null>(null);

  // Stringify filtros para usar como dep estable (cambios deep).
  const filtrosKey = JSON.stringify(filtros);

  useEffect(() => {
    if (!seccion) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardResumenSeccion({ seccion, filtros })
      .then((r) => {
        if (cancelled) return;
        setPayload(r.payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion, filtrosKey]);

  return { loading, error, payload };
}

export type ResumenKpisState = {
  loading: boolean;
  error: string | null;
  payload: DashboardKpisPayload | null;
};

export function useResumenKpis(filtros: DashboardFiltro[]): ResumenKpisState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardKpisPayload | null>(null);
  const filtrosKey = JSON.stringify(filtros);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardResumenKpis({ filtros })
      .then((r) => {
        if (cancelled) return;
        setPayload(r.payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey]);

  return { loading, error, payload };
}
