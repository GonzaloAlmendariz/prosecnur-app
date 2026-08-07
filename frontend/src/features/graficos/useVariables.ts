import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGraficosVariables, VarInfo, VariablesBySource } from "../../api/client";
import { useGraficosReportScope, type GraficosReportScope } from "./reportScope";
import { safeText } from "./safeText";

// Hook de variables del estudio (multi-base, v0.2+).
//
// Forma de retorno:
//   - `sources`: lista de fuentes con sus variables (siempre — incluso
//     con 1 base, hay 1 source).
//   - `multi`: true si hay >1 fuente → los pickers deben mostrar el
//     dropdown de fuente. Si es false, los pickers pueden omitir el
//     dropdown y tratar las variables como un pool único (back-compat).
//   - `variables`: array plano con TODAS las variables, con `source`
//     agregado como campo adicional. Útil para componentes que no
//     quieren pensar en el shape agrupado (ej. usePlanValidator).
//   - Helpers `allSources`, `variablesOf(source)`, `findVar(source, name)`.
//
// Cache a nivel módulo: inmutable por sesión (cambia si agregas/quitas
// bases, se invalida con `invalidateVariables()`).

export type VarWithSource = VarInfo & { source: string };

const cache: Record<GraficosReportScope, VariablesBySource | null> = {
  active: null,
  consolidated: null,
};
const pending: Record<GraficosReportScope, Promise<VariablesBySource> | null> = {
  active: null,
  consolidated: null,
};

if (typeof window !== "undefined") {
  const clearCache = () => {
    cache.active = null;
    cache.consolidated = null;
    pending.active = null;
    pending.consolidated = null;
  };
  const clearActiveCache = () => {
    cache.active = null;
    pending.active = null;
  };
  window.addEventListener("pulso:session-changed", clearCache);
  window.addEventListener("pulso:active-base-changed", clearActiveCache);
}

export function useVariables(): {
  sources: { name: string; source_kind?: string; variables: VarInfo[] }[];
  multi: boolean;
  variables: VarWithSource[];  // lista plana con `source` anotado
  loading: boolean;
  error: string;
} {
  const location = useLocation();
  const reportScope = useGraficosReportScope(location.search);
  const [data, setData] = useState<VariablesBySource | null>(cache[reportScope]);
  const [loading, setLoading] = useState<boolean>(!cache[reportScope]);
  const [error, setError] = useState<string>("");
  // `gen` avanza en cada invalidación (cambio de sesión) para gatillar
  // re-fetch del efecto aunque el cache ya se haya limpiado.
  const [gen, setGen] = useState(0);

  useEffect(() => {
    function invalidateCurrentScope() {
      setData(null);
      setLoading(true);
      setError("");
      setGen((g) => g + 1);
    }
    function onActiveBaseChanged() {
      if (reportScope === "active") invalidateCurrentScope();
    }
    window.addEventListener("pulso:session-changed", invalidateCurrentScope);
    window.addEventListener("pulso:active-base-changed", onActiveBaseChanged);
    return () => {
      window.removeEventListener("pulso:session-changed", invalidateCurrentScope);
      window.removeEventListener("pulso:active-base-changed", onActiveBaseChanged);
    };
  }, [reportScope]);

  useEffect(() => {
    setError("");
    if (cache[reportScope]) {
      setData(cache[reportScope]);
      setLoading(false);
      return;
    }
    setData(null);
    setLoading(true);
    if (!pending[reportScope]) {
      pending[reportScope] = apiGraficosVariables(reportScope).then((r) => {
        cache[reportScope] = r;
        pending[reportScope] = null;
        return r;
      }).catch((cause) => {
        pending[reportScope] = null;
        throw cause;
      });
    }
    let alive = true;
    pending[reportScope]
      .then((r) => {
        if (!alive) return;
        setData(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError((e as Error).message);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [gen, reportScope]);

  const sources = (data?.sources ?? []).map((source) => {
    const sourceName = safeText(source.name, "default");
    return {
      name: sourceName,
      source_kind: source.source_kind,
      variables: (source.variables ?? []).map((variable) => normalizeVarInfo(variable)),
    };
  });
  const multi = data?.multi ?? false;
  const variables: VarWithSource[] = [];
  for (const s of sources) {
    for (const v of s.variables) {
      variables.push({ ...v, source: s.name });
    }
  }

  return { sources, multi, variables, loading, error };
}

export function invalidateVariables() {
  cache.active = null;
  cache.consolidated = null;
  pending.active = null;
  pending.consolidated = null;
}

// Helper: parsea un value "fuente$variable" a sus partes. Si no tiene
// `$` o la fuente no existe en el estudio, devuelve la variable como
// perteneciente a la fuente "default" (back-compat single-base).
export function parseVarRef(ref: string | null | undefined): { source: string | null; name: string } {
  if (!ref) return { source: null, name: "" };
  // El payload de un slide viaja como JSON y sobrevive al cambio de graficador:
  // `vars` de multi-apiladas en modo `var_cruce` es un objeto de bloques, y al
  // pasar ese slide a Radar el picker recibe un objeto donde el tipo promete un
  // string. Sin esta guarda, `ref.indexOf` tumba la aplicación entera en vez de
  // mostrar el campo vacío para que el analista lo vuelva a llenar.
  if (typeof ref !== "string") return { source: null, name: "" };
  const idx = ref.indexOf("$");
  if (idx < 0) return { source: null, name: ref };
  return { source: ref.slice(0, idx), name: ref.slice(idx + 1) };
}

// Helper inverso: construye la ref "fuente$variable". Si multi=false,
// devuelve solo el nombre (sin prefijo) por compat visual.
export function formatVarRef(source: string | null, name: string, multi: boolean): string {
  if (!name) return "";
  if (!multi || !source) return name;
  return `${source}$${name}`;
}

function normalizeVarInfo(variable: VarInfo): VarInfo {
  const name = safeText(variable.name);
  return {
    ...variable,
    name,
    label: safeText(variable.label, name),
    tipo: safeText(variable.tipo),
    seccion: safeText(variable.seccion),
  };
}
