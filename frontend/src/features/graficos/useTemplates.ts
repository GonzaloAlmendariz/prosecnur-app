import { useEffect, useState } from "react";
import { apiGraficosTemplates, TemplateMeta } from "../../api/client";

// Cache a nivel módulo — los templates son estáticos por versión de backend.

let cache: TemplateMeta[] | null = null;
let pending: Promise<TemplateMeta[]> | null = null;

export function useTemplates(): {
  templates: TemplateMeta[];
  loading: boolean;
  error: string;
} {
  const [templates, setTemplates] = useState<TemplateMeta[]>(cache ?? []);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (cache) return;
    if (!pending) {
      pending = apiGraficosTemplates().then((r) => {
        cache = r.templates;
        pending = null;
        return r.templates;
      });
    }
    pending
      .then((r) => { setTemplates(r); setLoading(false); })
      .catch((e) => { setError((e as Error).message); setLoading(false); });
  }, []);

  return { templates, loading, error };
}
