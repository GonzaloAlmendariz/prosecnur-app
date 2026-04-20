import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart2, BookOpen, Database, Grid3x3, Users } from "lucide-react";
import { apiAnaliticaPreparar } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { useAnaliticaAutosave } from "./useAnaliticaAutosave";
import { AnaliticaHeader } from "./AnaliticaHeader";
import { CodebookPane } from "./panes/CodebookPane";
import { FrecuenciasPane } from "./panes/FrecuenciasPane";
import { CrucesPane } from "./panes/CrucesPane";
import { BasesPane } from "./panes/BasesPane";
import { EnumeradoresPane } from "./panes/EnumeradoresPane";

// 5 reportes en el orden que el analista suele correrlos: primero calidad
// de campo (enumeradores), luego diccionario (codebook), luego datos
// exportables (bases), luego tablas (frecuencias, cruces).
type Reporte = "enumeradores" | "codebook" | "bases" | "frecuencias" | "cruces";

type ReporteMeta = {
  key: Reporte;
  label: string;
  icon: typeof BookOpen;
  desc: string;
};

const REPORTES: ReporteMeta[] = [
  { key: "enumeradores", label: "Enumeradores", icon: Users,     desc: "PDF de producción" },
  { key: "codebook",     label: "Libro de códigos", icon: BookOpen, desc: "Diccionario de variables" },
  { key: "bases",        label: "Bases",        icon: Database,  desc: "Datos exportables (SPSS)" },
  { key: "frecuencias",  label: "Frecuencias",  icon: BarChart2, desc: "Tablas univariadas" },
  { key: "cruces",       label: "Cruces",       icon: Grid3x3,   desc: "Tablas 2D con semáforo" },
];

export default function AnaliticaPage() {
  const { state, refresh } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useAnaliticaAutosave();

  const prereqOk = !!state?.xlsform && !!state?.data;
  const prepOk = !!state?.analitica_prep_ok;

  // Preparar auto-on-mount. Antes era un paso manual; ahora se ejecuta
  // silenciosamente al entrar por primera vez si hay prereqs. El banner
  // de fuente en AnaliticaHeader muestra el resultado.
  const [prepBusy, setPrepBusy] = useState(false);
  const [prepError, setPrepError] = useState("");
  useEffect(() => {
    if (!prereqOk || prepOk || prepBusy) return;
    let cancelled = false;
    (async () => {
      setPrepBusy(true);
      setPrepError("");
      try {
        await apiAnaliticaPreparar();
        if (!cancelled) await refresh();
      } catch (e) {
        if (!cancelled) setPrepError((e as Error).message);
      } finally {
        if (!cancelled) setPrepBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prereqOk, prepOk]);

  // Reporte activo desde el query string.
  const raw = new URLSearchParams(location.search).get("reporte");
  const active: Reporte = (REPORTES.find((r) => r.key === raw)?.key) ?? "enumeradores";

  function goReporte(next: Reporte) {
    const sp = new URLSearchParams(location.search);
    if (next === "enumeradores") sp.delete("reporte");
    else sp.set("reporte", next);
    navigate({ pathname: "/analitica", search: sp.toString() ? `?${sp}` : "" });
  }

  useEffect(() => { window.scrollTo({ top: 0 }); }, [active]);

  return (
    <section>
      <h1 className="pulso-page-title">Fase 4 — Análisis y reportes</h1>
      <p className="pulso-page-lead">
        Genera los cinco reportes estándar de Pulso. Cada uno tiene su configuración y su descarga independiente.
      </p>

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">
            Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de analizar.
          </Alert>
        </div>
      )}

      {prereqOk && (
        <>
          <AnaliticaHeader prepBusy={prepBusy} prepError={prepError} />

          <div style={{ marginBottom: 18 }}>
            <ReporteStepper active={active} onChange={goReporte} />
          </div>

          {prepBusy ? (
            <Alert kind="info">Preparando datos…</Alert>
          ) : prepOk ? (
            <>
              {active === "enumeradores" && <EnumeradoresPane />}
              {active === "codebook"     && <CodebookPane />}
              {active === "bases"        && <BasesPane />}
              {active === "frecuencias"  && <FrecuenciasPane />}
              {active === "cruces"       && <CrucesPane />}
            </>
          ) : (
            <Alert kind="warn">
              La preparación automática de datos aún no terminó o falló. Recarga la página para reintentar.
            </Alert>
          )}
        </>
      )}
    </section>
  );
}

function ReporteStepper({ active, onChange }: { active: Reporte; onChange: (r: Reporte) => void }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "stretch", gap: 0,
        flexWrap: "wrap",
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        overflow: "hidden",
        background: "white",
      }}
    >
      {REPORTES.map((r, i) => {
        const Icon = r.icon;
        const isActive = active === r.key;
        const isLast = i === REPORTES.length - 1;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            style={{
              flex: "1 1 0",
              minWidth: 140,
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              gap: 2, padding: "12px 16px",
              background: isActive ? "var(--pulso-primary)" : "white",
              color: isActive ? "white" : "var(--pulso-text)",
              border: "none",
              borderRight: isLast ? "none" : "1px solid var(--pulso-border)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 120ms",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
              <Icon size={14} />
              {r.label}
            </span>
            <span style={{ fontSize: 10, opacity: isActive ? 0.85 : 0.7, letterSpacing: 0.2 }}>
              {r.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
