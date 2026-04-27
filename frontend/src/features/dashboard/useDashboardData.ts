import { useEffect, useState } from "react";
import {
  apiDashboardBaseDatosData,
  apiDashboardBaseDatosDiccionario,
  apiDashboardBaseDatosEstructura,
  apiDashboardDimCatalogo,
  apiDashboardDimCategoriasVar,
  apiDashboardDimFoda,
  apiDashboardDimPayload,
  apiDashboardDimSeccionesVars,
  apiDashboardManifest,
  apiDashboardRelacionCross,
  apiDashboardResumenKpis,
  apiDashboardResumenSeccion,
  apiDashboardSecciones,
  DashboardBaseDatosData,
  DashboardBaseDatosDiccionario,
  DashboardBaseDatosEstructura,
  DashboardDimCatalogo,
  DashboardDimCategoria,
  DashboardDimFodaPayload,
  DashboardDimPayload,
  DashboardDimSeccionesPayload,
  DashboardFiltro,
  DashboardKpisPayload,
  DashboardManifest,
  DashboardRelacionPayload,
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

// =============================================================================
// Tab Relaciones — cruce con debounce.
// =============================================================================

export type RelacionState = {
  loading: boolean;
  error: string | null;
  payload: DashboardRelacionPayload | null;
};

export function useRelacionCross(
  varPrincipal: string,
  varSegmento: string,
  filtros: DashboardFiltro[],
  iterar: { var: string } | null,
): RelacionState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardRelacionPayload | null>(null);

  const filtrosKey = JSON.stringify(filtros);
  const iterarKey = iterar?.var ?? "";

  useEffect(() => {
    if (!varPrincipal || !varSegmento) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      apiDashboardRelacionCross({
        var_principal: varPrincipal,
        var_segmento: varSegmento,
        filtros,
        iterar: iterar?.var ? iterar : null,
      })
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
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varPrincipal, varSegmento, filtrosKey, iterarKey]);

  return { loading, error, payload };
}

// =============================================================================
// Tab Base de datos — estructura, data paginada, diccionario.
// =============================================================================

export function useBaseDatosEstructura() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardBaseDatosEstructura | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardBaseDatosEstructura()
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
  }, []);

  return { loading, error, payload };
}

export function useBaseDatosData(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  page: number;
  pageSize: number;
  search: string;
  sort: { col: string; desc: boolean } | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardBaseDatosData | null>(null);

  const variablesKey = JSON.stringify(opts.variables);
  const sortKey = JSON.stringify(opts.sort);

  useEffect(() => {
    if (!opts.variables.length) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      apiDashboardBaseDatosData({
        modo: opts.modo,
        variables: opts.variables,
        page: opts.page,
        page_size: opts.pageSize,
        search: opts.search,
        sort: opts.sort,
      })
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
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.modo, variablesKey, opts.page, opts.pageSize, opts.search, sortKey]);

  return { loading, error, payload };
}

// =============================================================================
// Tab Dimensiones — catálogo, secciones-vars, payload, categorías-var.
// =============================================================================

export function useDimCatalogo() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardDimCatalogo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardDimCatalogo()
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
  }, []);

  return { loading, error, payload };
}

export function useDimSeccionesVars() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardDimSeccionesPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardDimSeccionesVars()
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
  }, []);

  return { loading, error, payload };
}

export function useDimPayload(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce: string;
  incluirTotal: boolean;
  iter: { var: string; level?: string } | null;
  filtros: DashboardFiltro[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardDimPayload | null>(null);

  const filtrosKey = JSON.stringify(opts.filtros);
  const iterKey = JSON.stringify(opts.iter);

  useEffect(() => {
    if (!opts.objetivo) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      apiDashboardDimPayload({
        modo: opts.modo,
        objetivo: opts.objetivo,
        cruce: opts.cruce || undefined,
        incluir_total: opts.incluirTotal,
        iter: opts.iter,
        filtros: opts.filtros,
      })
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
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.modo, opts.objetivo, opts.cruce, opts.incluirTotal, iterKey, filtrosKey]);

  return { loading, error, payload };
}

export function useDimFoda(opts: {
  enabled: boolean;
  modo: "general" | "indicadores";
  objetivo: string;
  cruce: string;
  incluirTotal: boolean;
  iter: { var: string; level?: string } | null;
  filtros: DashboardFiltro[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardDimFodaPayload | null>(null);

  const filtrosKey = JSON.stringify(opts.filtros);
  const iterKey = JSON.stringify(opts.iter);

  useEffect(() => {
    if (!opts.enabled || !opts.objetivo) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      apiDashboardDimFoda({
        modo: opts.modo,
        objetivo: opts.objetivo,
        cruce: opts.cruce || undefined,
        incluir_total: opts.incluirTotal,
        iter: opts.iter,
        filtros: opts.filtros,
      })
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
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled, opts.modo, opts.objetivo, opts.cruce, opts.incluirTotal, iterKey, filtrosKey]);

  return { loading, error, payload };
}

export function useDimCategoriasVar(variable: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valores, setValores] = useState<DashboardDimCategoria[]>([]);

  useEffect(() => {
    if (!variable) {
      setValores([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardDimCategoriasVar(variable)
      .then((r) => {
        if (cancelled) return;
        setValores(r.valores);
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
  }, [variable]);

  return { loading, error, valores };
}

export function useDiccionarioVariable(variable: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardBaseDatosDiccionario | null>(null);

  useEffect(() => {
    if (!variable) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardBaseDatosDiccionario(variable)
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
  }, [variable]);

  return { loading, error, payload };
}
