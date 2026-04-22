import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart2, BookOpen, Database, Grid3x3, Users } from "lucide-react";
import { apiAnaliticaPreparar } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PageHeader } from "../../components/PageHeader";
import { TabStrip, TabMeta } from "../../components/TabStrip";
import { useAnaliticaAutosave } from "./useAnaliticaAutosave";
import { AnaliticaHeader } from "./AnaliticaHeader";
import { DefinicionGlobal } from "./DefinicionGlobal";
import { CodebookPane } from "./panes/CodebookPane";
import { FrecuenciasPane } from "./panes/FrecuenciasPane";
import { CrucesPane } from "./panes/CrucesPane";
import { BasesPane } from "./panes/BasesPane";
import { EnumeradoresPane } from "./panes/EnumeradoresPane";

// 5 reportes en el orden que el analista suele correrlos: primero calidad
// de campo (enumeradores), luego diccionario (codebook), luego datos
// exportables (bases), luego tablas (frecuencias, cruces).
type Reporte = "enumeradores" | "codebook" | "bases" | "frecuencias" | "cruces";

const REPORTES: TabMeta<Reporte>[] = [
  { key: "enumeradores", label: "Enumeradores",      icon: Users,     desc: "PDF de producción" },
  { key: "codebook",     label: "Libro de códigos",  icon: BookOpen,  desc: "Diccionario de variables" },
  { key: "bases",        label: "Bases",             icon: Database,  desc: "Datos exportables (SPSS)" },
  { key: "frecuencias",  label: "Frecuencias",       icon: BarChart2, desc: "Tablas univariadas" },
  { key: "cruces",       label: "Cruces",            icon: Grid3x3,   desc: "Tablas 2D con semáforo" },
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
      <PageHeader
        title="Fase 4 — Análisis y reportes"
        lead="Genera los cinco reportes estándar de Prosecnur. Cada uno tiene su configuración y su descarga independiente."
      />

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

          {prepOk && <DefinicionGlobal />}

          <div style={{ marginBottom: 18 }}>
            <TabStrip<Reporte>
              tabs={REPORTES}
              active={active}
              onChange={goReporte}
              ariaLabel="Reportes disponibles"
            />
          </div>

          {prepBusy ? (
            <LoadingBlock label="Preparando datos…" />
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

// ReporteStepper local reemplazado por `TabStrip` de
// components/TabStrip.tsx — unificado con otras fases que usen
// tabs horizontales.
