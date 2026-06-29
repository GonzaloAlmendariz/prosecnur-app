import { Suspense, useEffect, useMemo, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { AlertCircle, Activity } from "lucide-react";
import { LoadingBlock } from "../../components/States";
import { apiMonitoreoState, type MonitoreoState } from "../../api/client";
import { MODULE_TONES } from "../../lib/modules";
import { preloadMonitoreoFamily, normalizeMonitoreoFamily } from "./profiles/registry";
import type { MonitoreoFamilyId, MonitoreoFamilyModule } from "./profiles/types";
import "./MonitoreoShell.css";

type ForcedMonitoreoSurface = "legacy-territorial" | "territorial-modular" | "acreditacion-modular";

const FORCED_SURFACE_LABELS: Record<ForcedMonitoreoSurface, string> = {
  "legacy-territorial": "Territorial canonico",
  "territorial-modular": "Territorial modular",
  "acreditacion-modular": "Acreditacion modular",
};

function forcedMonitoreoSurfaceFromUrl(): ForcedMonitoreoSurface | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("monitoreoSurface");
  return value === "legacy-territorial" || value === "territorial-modular" || value === "acreditacion-modular" ? value : null;
}

function loadForcedMonitoreoSurface(surface: ForcedMonitoreoSurface) {
  if (surface === "legacy-territorial") return import("./MonitoreoPage");
  if (surface === "acreditacion-modular") return import("./profiles/acreditacion/AcreditacionMonitoreoPage");
  return import("./profiles/territorial/TerritorialMonitoreoPage");
}

function familyFromState(state: MonitoreoState | null): MonitoreoFamilyId {
  return normalizeMonitoreoFamily(
    state?.monitoreo_profile?.family ?? state?.config?.monitoreo_profile?.family,
  ) ?? "acreditacion";
}

function ShellFallback({ label = "Preparando monitoreo" }: { label?: string }) {
  return (
    <div className="mon-shell-fallback" style={MODULE_TONES.monitoreo as CSSProperties}>
      <div className="mon-shell-fallback__mark" aria-hidden="true">
        <Activity size={20} />
      </div>
      <div>
        <strong>{label}</strong>
        <span>Preparando la vista del proyecto...</span>
      </div>
    </div>
  );
}

export default function MonitoreoShell() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [profile, setProfile] = useState<MonitoreoFamilyModule | null>(null);
  const [Page, setPage] = useState<ComponentType | null>(null);
  const [error, setError] = useState("");
  const forcedSurface = useMemo(() => forcedMonitoreoSurfaceFromUrl(), []);

  useEffect(() => {
    let cancelled = false;
    setError("");

    if (forcedSurface) {
      setState(null);
      setProfile(null);
      setPage(null);
      loadForcedMonitoreoSurface(forcedSurface)
        .then((pageModule) => {
          if (!cancelled) setPage(() => pageModule.default);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError((e as Error).message);
        });
      return () => {
        cancelled = true;
      };
    }

    apiMonitoreoState({ includeReports: false, warmupCache: true })
      .then(async (next) => {
        if (cancelled) return;
        setState(next);
        const family = familyFromState(next);
        const loaded = await preloadMonitoreoFamily(family);
        if (cancelled) return;
        if (!loaded) throw new Error("No se pudo resolver el perfil de Monitoreo.");
        setProfile(loaded);
        const pageModule = await loaded.loadPage();
        if (cancelled) return;
        setPage(() => pageModule.default);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [forcedSurface]);

  const label = useMemo(
    () => (forcedSurface ? FORCED_SURFACE_LABELS[forcedSurface] : profile?.label ?? (state ? familyFromState(state) : "Monitoreo")),
    [forcedSurface, profile, state],
  );

  if (error) {
    return (
      <div className="mon-shell-error" style={MODULE_TONES.monitoreo as CSSProperties}>
        <AlertCircle size={20} />
        <div>
          <strong>No se pudo abrir Monitoreo</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!Page) return <ShellFallback label={`Preparando ${label}`} />;

  return (
    <Suspense fallback={<LoadingBlock label={`Abriendo ${label}...`} />}>
      <Page />
    </Suspense>
  );
}
