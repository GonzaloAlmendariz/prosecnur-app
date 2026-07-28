import { Suspense, useEffect, useMemo, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { AlertCircle } from "lucide-react";
import { LoadingBlock } from "../../components/States";
import { apiMonitoreoConfig, apiMonitoreoState, type MonitoreoState } from "../../api/client";
import { MODULE_TONES } from "../../lib/modules";
import { preloadMonitoreoFamily, normalizeMonitoreoFamily } from "./profiles/registry";
import type { MonitoreoFamilyId, MonitoreoFamilyModule } from "./profiles/types";
import { MonitoreoModeChoice } from "./MonitoreoModeChoice";
import type { MonitoreoModo, MonitoreoModoDefinicion } from "./core/monitoreoRegistry";
import "./MonitoreoShell.css";

function familyFromState(state: MonitoreoState | null): MonitoreoFamilyId {
  return normalizeMonitoreoFamily(
    state?.monitoreo_profile?.family ?? state?.config?.monitoreo_profile?.family,
  ) ?? "acreditacion";
}

function routeSelectedFromState(state: MonitoreoState | null): boolean {
  return (
    state?.monitoreo_profile?.route_selected ??
    state?.config?.monitoreo_profile?.route_selected
  ) === true;
}

/* Usa la primitiva compartida: antes era una tarjeta propia con ícono y dos
 * líneas, así que la misma espera se veía distinta según por dónde entraras
 * —anillo en el arranque, tarjeta acá, bloque en el resto de los módulos—. */
function ShellFallback({ label = "Preparando monitoreo" }: { label?: string }) {
  return (
    <div className="mon-shell-fallback" style={MODULE_TONES.monitoreo as CSSProperties}>
      <LoadingBlock label={label} />
    </div>
  );
}

export default function MonitoreoShell() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [profile, setProfile] = useState<MonitoreoFamilyModule | null>(null);
  const [Page, setPage] = useState<ComponentType | null>(null);
  const [error, setError] = useState("");
  const [busyFamily, setBusyFamily] = useState<MonitoreoModo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError("");

    apiMonitoreoState({ includeReports: false, warmupCache: true })
      .then((next) => {
        if (cancelled) return;
        setState(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state || !routeSelectedFromState(state)) {
      setProfile(null);
      setPage(null);
      return;
    }

    let cancelled = false;
    const family = familyFromState(state);
    setError("");
    setPage(null);

    preloadMonitoreoFamily(family)
      .then(async (loaded) => {
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
  }, [state]);

  const chooseMode = async (mode: MonitoreoModoDefinicion) => {
    if (!state || busyFamily) return;
    setBusyFamily(mode.family);
    setError("");
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: {
          ...state.config.monitoreo_profile,
          family: mode.family,
          status: mode.status,
          variant: "multi_actor",
          route_selected: true,
          locked_at: new Date().toISOString(),
        },
      });
      setState(result.state);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusyFamily(null);
    }
  };

  const label = useMemo(
    () => profile?.label ?? (state ? familyFromState(state) : "Monitoreo"),
    [profile, state],
  );

  if (error && (!state || routeSelectedFromState(state))) {
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

  if (state && !routeSelectedFromState(state)) {
    return (
      <MonitoreoModeChoice
        busyFamily={busyFamily}
        error={error}
        onChoose={(mode) => void chooseMode(mode)}
      />
    );
  }

  if (!Page) return <ShellFallback label={`Preparando ${label}`} />;

  return (
    <Suspense fallback={<LoadingBlock label={`Abriendo ${label}...`} />}>
      <Page />
    </Suspense>
  );
}
