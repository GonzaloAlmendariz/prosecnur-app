import { useEffect, useState } from "react";
import { apiGraficosVariables, VarInfo, VariablesBySource } from "../../api/client";

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

let cache: VariablesBySource | null = null;
let pending: Promise<VariablesBySource> | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", () => {
    cache = null;
    pending = null;
  });
}

export function useVariables(): {
  sources: { name: string; variables: VarInfo[] }[];
  multi: boolean;
  variables: VarWithSource[];  // lista plana con `source` anotado
  loading: boolean;
  error: string;
} {
  const [data, setData] = useState<VariablesBySource | null>(cache);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string>("");
  // `gen` avanza en cada invalidación (cambio de sesión) para gatillar
  // re-fetch del efecto aunque el cache ya se haya limpiado.
  const [gen, setGen] = useState(0);

  useEffect(() => {
    function onSessionChanged() {
      setData(null);
      setLoading(true);
      setGen((g) => g + 1);
    }
    window.addEventListener("pulso:session-changed", onSessionChanged);
    return () => window.removeEventListener("pulso:session-changed", onSessionChanged);
  }, []);

  useEffect(() => {
    if (cache) {
      setData(cache);
      setLoading(false);
      return;
    }
    if (!pending) {
      pending = apiGraficosVariables().then((r) => {
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
  }, [gen]);

  const sources = data?.sources ?? [];
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
  cache = null;
  pending = null;
}

// Helper: parsea un value "fuente$variable" a sus partes. Si no tiene
// `$` o la fuente no existe en el estudio, devuelve la variable como
// perteneciente a la fuente "default" (back-compat single-base).
export function parseVarRef(ref: string | null | undefined): { source: string | null; name: string } {
  if (!ref) return { source: null, name: "" };
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
