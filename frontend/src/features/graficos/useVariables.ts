import { useEffect, useState } from "react";
import { apiGraficosVariables, VarInfo } from "../../api/client";

let cache: VarInfo[] | null = null;
let pending: Promise<VarInfo[]> | null = null;

export function useVariables(): { variables: VarInfo[]; loading: boolean; error: string } {
  const [variables, setVariables] = useState<VarInfo[]>(cache ?? []);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (cache) return;
    if (!pending) {
      pending = apiGraficosVariables().then((r) => {
        cache = r.variables;
        pending = null;
        return r.variables;
      });
    }
    pending
      .then((vars) => {
        setVariables(vars);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, []);

  return { variables, loading, error };
}

export function invalidateVariables() {
  cache = null;
  pending = null;
}
