import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { AlertCircle } from "lucide-react";
import { LoadingBlock } from "../../components/States";
import { apiMonitoreoConfig, apiMonitoreoState, apiProjectOverview, type MonitoreoState } from "../../api/client";
import { MODULE_TONES } from "../../lib/modules";
import { marcarCargaExitosa, recargarSiElBuildCambio } from "../../lib/lazyWithReload";
import { preloadMonitoreoFamily, normalizeMonitoreoFamily } from "./profiles/registry";
import type { MonitoreoFamilyId, MonitoreoFamilyModule } from "./profiles/types";
import { MonitoreoModeChoice } from "./MonitoreoModeChoice";
import type { MonitoreoModo, MonitoreoModoDefinicion } from "./core/monitoreoRegistry";
import { sugerirModoDeMonitoreo, type SugerenciaDeModo } from "./core/sugerenciaDeModo";
import { decidirAterrizajeDeMonitoreo } from "./core/aterrizajeDeMonitoreo";
import { usePlannerModos } from "../estudio/usePlannerModos";
import { PerfilNoDeclarado } from "../estudio/PerfilNoDeclarado";
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
  const [sugerencia, setSugerencia] = useState<SugerenciaDeModo | null>(null);
  // ADR 0122 P2: el modo lo fijan los perfiles declarados en el Planner.
  const { modos: plannerModos, error: plannerError } = usePlannerModos();
  const familiaElegida = state && routeSelectedFromState(state) ? familyFromState(state) : null;
  const aterrizaje = decidirAterrizajeDeMonitoreo(plannerModos, plannerError, familiaElegida);
  const puedeAbrir = aterrizaje.tipo === "abrir" || aterrizaje.tipo === "respaldo";

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
    // El modo que corresponde a lo que el proyecto ya tiene. Va aparte del
    // estado de Monitoreo a propósito: si el overview falla, la elección sigue
    // funcionando sin marca. Una sugerencia nunca puede bloquear la pantalla
    // que sugiere.
    apiProjectOverview()
      .then((overview) => {
        if (cancelled) return;
        setSugerencia(sugerirModoDeMonitoreo(overview?.facts));
      })
      .catch(() => {
        if (!cancelled) setSugerencia(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state || !routeSelectedFromState(state) || !puedeAbrir) {
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
        marcarCargaExitosa(`monitoreo-${family}`);
        setPage(() => pageModule.default);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Con el build regenerado, la página se recarga y el fallback sigue
        // montado mientras tanto; sólo un segundo fallo llega a la pantalla.
        if (recargarSiElBuildCambio(e, `monitoreo-${family}`)) return;
        setError((e as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [state, puedeAbrir]);

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

  // D7b (coordinación, 2 nov, reversible): el modo «lo determina el estudio,
  // no un click» y el tipo vive en la Ficha (ADR 0124). Con un tipo declarado y
  // la config todavía sin él, Monitoreo entra solo, una vez; si falla, vuelve
  // la tarjeta con el error para elegir a mano.
  const autoAlineado = useRef(false);
  useEffect(() => {
    if (!state || aterrizaje.tipo !== "alinear" || busyFamily || autoAlineado.current) return;
    autoAlineado.current = true;
    void chooseMode(aterrizaje.modo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, aterrizaje.tipo]);

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

  if (state && aterrizaje.tipo === "cargando") return <ShellFallback label="Leyendo el tipo del estudio" />;
  if (state && aterrizaje.tipo === "sin-perfil") {
    return (
      <div className="mon-shell-fallback" style={MODULE_TONES.monitoreo as CSSProperties}>
        <PerfilNoDeclarado detalle="Monitoreo abre en el modo que fija el tipo del estudio." />
      </div>
    );
  }
  // Alinear: entra solo (arriba); mientras guarda, y salvo que falle, no pregunta.
  if (state && aterrizaje.tipo === "alinear" && !error) {
    return <ShellFallback label={`Abriendo ${aterrizaje.modo.label}, el tipo que declara la ficha`} />;
  }
  // Elegir (el Planner deja más de un modo) o alinear que falló: un clic lo fija.
  if (state && (aterrizaje.tipo === "alinear" || aterrizaje.tipo === "elegir")) {
    const modos = aterrizaje.tipo === "alinear" ? [aterrizaje.modo] : aterrizaje.modos;
    return (
      <MonitoreoModeChoice
        modes={modos}
        busyFamily={busyFamily}
        error={error}
        sugerencia={aterrizaje.tipo === "alinear"
          ? { family: aterrizaje.modo.family, motivo: "Es el tipo que declara la ficha del estudio." } as SugerenciaDeModo
          : null}
        onChoose={(mode) => void chooseMode(mode)}
      />
    );
  }

  if (state && !routeSelectedFromState(state)) {
    return (
      <MonitoreoModeChoice
        busyFamily={busyFamily}
        error={error}
        sugerencia={sugerencia}
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
