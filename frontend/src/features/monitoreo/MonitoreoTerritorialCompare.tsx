import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./MonitoreoShell.css";

type ComparisonFamily = "territorial" | "acreditacion";
type ComparisonSurface = "legacy-territorial" | "territorial-modular" | "acreditacion-modular";
type ComparisonTarget = {
  view: string;
  tab: string;
};

type ComparisonPane = {
  key: ComparisonSurface;
  title: string;
  eyebrow: string;
};

type ComparisonConfig = {
  title: string;
  subtitle: string;
  panes: ComparisonPane[];
};

const COMPARISON_CONFIGS: Record<ComparisonFamily, ComparisonConfig> = {
  territorial: {
    title: "Comparacion territorial",
    subtitle: "Canonico vs modular",
    panes: [
      {
        key: "legacy-territorial",
        title: "Canonico historico",
        eyebrow: "MonitoreoPage.tsx",
      },
      {
        key: "territorial-modular",
        title: "Nuevo modular",
        eyebrow: "TerritorialMonitoreoPage.tsx",
      },
    ],
  },
  acreditacion: {
    title: "Comparacion Acreditacion",
    subtitle: "Original vs independiente",
    panes: [
      {
        key: "legacy-territorial",
        title: "Original canonico",
        eyebrow: "MonitoreoPage.tsx",
      },
      {
        key: "acreditacion-modular",
        title: "Acreditacion independiente",
        eyebrow: "AcreditacionMonitoreoPage.tsx",
      },
    ],
  },
};

function comparisonFamilyFromLocation(): ComparisonFamily {
  if (typeof window === "undefined") return "territorial";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("compareFamily") ?? params.get("family") ?? "";
  if (requested === "acreditacion" || window.location.pathname.includes("comparar-acreditacion")) {
    return "acreditacion";
  }
  return "territorial";
}

function projectLabelFromUrl() {
  if (typeof window === "undefined") return "Proyecto actual";
  const currentParams = new URLSearchParams(window.location.search);
  for (const projectParam of ["devPulso", "devProject", "pulso"]) {
    const projectPath = currentParams.get(projectParam);
    if (!projectPath) continue;
    return projectPath.split(/[\\/]/).pop() || projectPath;
  }
  return "Proyecto actual";
}

function comparisonTargetFromLocation(): ComparisonTarget {
  if (typeof window === "undefined") return { view: "", tab: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    view: params.get("compareView") ?? "",
    tab: params.get("compareTab") ?? "",
  };
}

function targetLabel(value: string) {
  if (value === "telefonico") return "Teléfono";
  if (value === "avance") return "Avance";
  if (value === "fuentes") return "Fuentes";
  if (value === "modelo") return "Modelo";
  if (value === "consultas") return "Consultas";
  if (value === "alertas") return "Alertas";
  if (value === "responsables") return "Responsables";
  if (value === "dia") return "Día";
  if (value === "resumen") return "Resumen";
  return value;
}

function textMatchesLabel(text: string, label: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .includes(label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
}

function clickButtonByLabel(doc: Document, label: string) {
  if (!label) return false;
  const buttons = Array.from(doc.querySelectorAll<HTMLButtonElement>("button"));
  const target = buttons.find((button) => !button.disabled && textMatchesLabel(button.textContent ?? "", label));
  if (!target) return false;
  target.click();
  return true;
}

function frameDataBlocker(text: string, target: ComparisonTarget) {
  if (/Selecciona un proyecto|Sin proyecto/i.test(text)) return "Proyecto sin sesión";
  if (/Resumen pendiente|Todav[ií]a no hay reporte local preparado/i.test(text)) return "Resumen pendiente";
  if (/ACTIVAS 0\/0|CORTE SIN CORTE/i.test(text)) return "Proyecto sin corte";
  const view = targetLabel(target.view);
  const tab = targetLabel(target.tab);
  const isPhone = textMatchesLabel(view, "Teléfono");
  if (isPhone) {
    if (/Sin monitoreo telef[oó]nico|Sin hoja de barrido/i.test(text)) return "Telefonico sin reporte";
    if (!/Monitoreo telef[oó]nico|Barrido telef[oó]nico|Operaci[oó]n telef[oó]nica/i.test(text)) return "Telefonico no visible";
    if (textMatchesLabel(tab, "Día") && !/Ritmo diario|Avance diario|Total diario|Efectivas/i.test(text)) {
      return "Serie diaria no visible";
    }
  }
  return "";
}

function comparisonSurfaceUrl(surface: ComparisonSurface) {
  if (typeof window === "undefined") return `/monitoreo?monitoreoSurface=${surface}`;
  const url = new URL("/monitoreo", window.location.href);
  const currentParams = new URLSearchParams(window.location.search);
  url.search = "";
  url.hash = "";
  url.searchParams.set("monitoreoSurface", surface);
  for (const projectParam of ["devPulso", "devProject", "pulso"]) {
    const projectPath = currentParams.get(projectParam);
    if (projectPath) {
      url.searchParams.set(projectParam, projectPath);
      break;
    }
  }
  if (currentParams.get("qaWarmup") === "skip") {
    url.searchParams.set("qaWarmup", "skip");
  }
  return `${url.pathname}${url.search}`;
}

function frameActivateTarget(frame: HTMLIFrameElement | null, target: ComparisonTarget) {
  try {
    const doc = frame?.contentDocument;
    if (!doc) return;
    if (target.view) clickButtonByLabel(doc, targetLabel(target.view));
    if (target.tab) clickButtonByLabel(doc, targetLabel(target.tab));
  } catch {
    // Same-origin frame access can briefly fail during iframe navigation.
  }
}

function frameHasMonitoreoReadyState(frame: HTMLIFrameElement | null, surface: ComparisonSurface, target: ComparisonTarget) {
  try {
    const doc = frame?.contentDocument;
    if (!doc) return false;
    const text = doc.body?.innerText ?? "";
    if (/Selecciona un proyecto|Sin proyecto|Preparando vista|Preparando datos|Preparando consultas|Preparando UMPs|Preparando validaci[oó]n|Preparando avance|Preparando ocurrencias|Leyendo cache local|Cargando monitoreo|Preparando monitoreo|Cargando datos|Cargando consultas|Cargando UMPs|Cargando manzanas|Cargando calles|Cargando GPS/i.test(text)) return false;
    if (frameDataBlocker(text, target)) return false;
    if (target.view || target.tab) {
      const viewOk = !target.view || textMatchesLabel(text, targetLabel(target.view)) || /Monitoreo telefónico|Barrido telefónico/i.test(text);
      const tabOk = !target.tab || textMatchesLabel(text, targetLabel(target.tab)) || /Pendientes e insistencia|Supervisión telefónica|No efectivos/i.test(text);
      return viewOk && tabOk;
    }
    if (surface === "acreditacion-modular") {
      return Boolean(doc.querySelector(".mon-acr-sources-panel--standalone"));
    }
    if (doc.querySelector('[data-audit-ready="monitoreo"], [data-audit-ready="monitoreo-acreditacion"]')) return true;
    return /Monitoreo territorial|Acreditacion|Acreditación/i.test(text);
  } catch {
    return false;
  }
}

function ComparisonFrame({
  pane,
  src,
  ready,
  target,
  onReadyChange,
}: {
  pane: ComparisonPane;
  src: string;
  ready: boolean;
  target: ComparisonTarget;
  onReadyChange: (surface: ComparisonSurface, ready: boolean) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const lastReadyRef = useRef<boolean | null>(null);

  useEffect(() => {
    lastReadyRef.current = null;
    const notifyReady = (nextReady: boolean) => {
      if (lastReadyRef.current === nextReady) return;
      lastReadyRef.current = nextReady;
      onReadyChange(pane.key, nextReady);
    };
    notifyReady(false);
    const checkReady = () => {
      frameActivateTarget(frameRef.current, target);
      if (frameHasMonitoreoReadyState(frameRef.current, pane.key, target)) {
        notifyReady(true);
      }
    };
    const interval = window.setInterval(checkReady, 500);
    checkReady();
    return () => {
      window.clearInterval(interval);
    };
  }, [onReadyChange, pane.key, src, target]);

  return (
    <article className="mon-territorial-compare__pane" data-frame-ready={ready ? "true" : "false"}>
      <header className="mon-territorial-compare__pane-head">
        <span>{pane.eyebrow}</span>
        <strong>{pane.title}</strong>
      </header>
      <div className="mon-territorial-compare__viewport">
        <iframe
          ref={frameRef}
          title={pane.title}
          src={src}
          className="mon-territorial-compare__frame"
          onLoad={() => {
            frameActivateTarget(frameRef.current, target);
            const nextReady = frameHasMonitoreoReadyState(frameRef.current, pane.key, target);
            if (lastReadyRef.current !== nextReady) {
              lastReadyRef.current = nextReady;
              onReadyChange(pane.key, nextReady);
            }
          }}
        />
      </div>
    </article>
  );
}

export default function MonitoreoTerritorialCompare() {
  const [loaded, setLoaded] = useState<Partial<Record<ComparisonSurface, boolean>>>({});
  const family = useMemo(() => comparisonFamilyFromLocation(), []);
  const config = COMPARISON_CONFIGS[family];
  const projectLabel = useMemo(() => projectLabelFromUrl(), []);
  const target = useMemo(() => comparisonTargetFromLocation(), []);
  const setPaneReady = useCallback((surface: ComparisonSurface, isReady: boolean) => {
    setLoaded((current) => (
      current[surface] === isReady ? current : { ...current, [surface]: isReady }
    ));
  }, []);
  const urls = useMemo(
    () => Object.fromEntries(config.panes.map((pane) => [pane.key, comparisonSurfaceUrl(pane.key)])) as Record<ComparisonSurface, string>,
    [config.panes],
  );
  const ready = config.panes.every((pane) => loaded[pane.key]);

  return (
    <section
      className="mon-territorial-compare"
      data-audit-ready={ready ? "monitoreo-territorial-compare" : undefined}
      data-audit-state={ready ? "ready" : "loading"}
      data-compare-family={family}
    >
      <header className="mon-territorial-compare__bar">
        <div>
          <span>{config.title}</span>
          <strong>{projectLabel}</strong>
        </div>
        <small>{target.view || target.tab ? `${config.subtitle} · ${[targetLabel(target.view), targetLabel(target.tab)].filter(Boolean).join(" / ")}` : config.subtitle}</small>
      </header>

      <div className="mon-territorial-compare__grid">
        {config.panes.map((pane) => (
          <ComparisonFrame
          key={pane.key}
          pane={pane}
          src={urls[pane.key]}
          ready={Boolean(loaded[pane.key])}
          target={target}
          onReadyChange={setPaneReady}
        />
      ))}
      </div>
    </section>
  );
}
