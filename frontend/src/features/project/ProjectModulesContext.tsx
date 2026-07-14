import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  apiProjectModulesSet,
  apiProjectOverview,
  type ProjectOverview,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";

// Slugs de módulos primarios que un proyecto puede agregar (coincide con
// lib/modules.ts y el backend). "diseno-estudio" es Bitácora.
export const PRIMARY_MODULE_SLUGS = [
  "diseno-estudio",
  "procesamiento",
  "calc-muestra",
  "editor-xlsform",
  "hojas-ruta",
  "recopiladores",
  "monitoreo",
  "dashboard",
] as const;

const PROCESAMIENTO_SUBMODULES = ["carga", "validacion", "codificacion", "analitica", "graficos"];

// Cuando el proyecto nunca curó su lista de módulos, derivamos un default a
// partir del avance real: solo los módulos que ya tienen trabajo.
function deriveDefaultAdded(overview: ProjectOverview): string[] {
  const byId = new Map(overview.modules.map((m) => [m.id, m] as const));
  const hasWork = (id: string) => {
    const m = byId.get(id);
    return !!m && m.state !== "pending";
  };
  const out: string[] = [];
  if (overview.maturity.level === "in_progress" || hasWork("plan-trabajo")) {
    out.push("diseno-estudio");
  }
  if (PROCESAMIENTO_SUBMODULES.some(hasWork)) out.push("procesamiento");
  for (const slug of ["calc-muestra", "editor-xlsform", "hojas-ruta", "recopiladores", "monitoreo", "dashboard"]) {
    if (hasWork(slug)) out.push(slug);
  }
  return out;
}

function canonicalOrder(slugs: string[]): string[] {
  return PRIMARY_MODULE_SLUGS.filter((slug) => slugs.includes(slug));
}

type ProjectModulesValue = {
  overview: ProjectOverview | null;
  loading: boolean;
  addedSlugs: string[];
  isAdded: (slug: string) => boolean;
  addModule: (slug: string) => void;
  removeModule: (slug: string) => void;
  refresh: () => void;
};

const ProjectModulesContext = createContext<ProjectModulesValue | null>(null);

export function ProjectModulesProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useSession();
  const { pathname } = useLocation();
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [loading, setLoading] = useState(true);
  // Lista explícita persistida (null = nunca curada → se deriva del avance).
  const [explicit, setExplicit] = useState<string[] | null>(null);
  const lastLoadContext = useRef({ sessionId: "", pathname: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiProjectOverview();
      setOverview(data);
      // Defensivo: solo un array cuenta como lista curada; cualquier otra cosa
      // (undefined/objeto) → null → se deriva el default desde el avance.
      setExplicit(Array.isArray(data.added_modules) ? data.added_modules : null);
    } catch {
      setOverview(null);
      setExplicit(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const previous = lastLoadContext.current;
    const sessionChanged = sessionId.length > 0 && previous.sessionId !== sessionId;
    const returnedHome = pathname === "/" && previous.pathname !== "/";
    lastLoadContext.current = { sessionId, pathname };
    if (!sessionId || (!sessionChanged && !returnedHome)) return;
    void load();
  }, [load, pathname, sessionId]);

  const addedSlugs = useMemo(() => {
    if (explicit) return canonicalOrder(explicit);
    if (overview) return deriveDefaultAdded(overview);
    return [];
  }, [explicit, overview]);

  const persist = useCallback(async (next: string[]) => {
    const clean = canonicalOrder(next);
    setExplicit(clean); // optimista
    try {
      await apiProjectModulesSet(clean);
    } catch {
      void load();
    }
  }, [load]);

  const addModule = useCallback(
    (slug: string) => {
      if (!PRIMARY_MODULE_SLUGS.includes(slug as (typeof PRIMARY_MODULE_SLUGS)[number])) return;
      if (addedSlugs.includes(slug)) return;
      void persist([...addedSlugs, slug]);
    },
    [addedSlugs, persist],
  );

  const removeModule = useCallback(
    (slug: string) => {
      void persist(addedSlugs.filter((s) => s !== slug));
    },
    [addedSlugs, persist],
  );

  const value = useMemo<ProjectModulesValue>(
    () => ({
      overview,
      loading,
      addedSlugs,
      isAdded: (slug: string) => addedSlugs.includes(slug),
      addModule,
      removeModule,
      refresh: () => void load(),
    }),
    [overview, loading, addedSlugs, addModule, removeModule, load],
  );

  return <ProjectModulesContext.Provider value={value}>{children}</ProjectModulesContext.Provider>;
}

export function useProjectModules(): ProjectModulesValue {
  const ctx = useContext(ProjectModulesContext);
  if (!ctx) {
    throw new Error("useProjectModules debe usarse dentro de ProjectModulesProvider");
  }
  return ctx;
}
