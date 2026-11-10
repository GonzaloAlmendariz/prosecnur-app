// Menú "Conjunto" de la fila de bases de Procesamiento: configurar el informe compartido y armar el paquete por bases.
//
// El paquete es una entrega del kit (ADR 0133, fase 5), en forma anclada: al elegirlo el menú se cierra, el disparador
// solo se deshabilita y el contenedor de archivo cuelga de él con el avance del job, el ZIP listo y los avisos del motor
// al pie, o el fallo con "Reintentar".

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Archive, CheckCircle2, ChevronDown, LayoutGrid, Loader2 } from "../../vendor/lucide-react";
import {
  apiGraficosConsolidadoPreflight,
  apiGraficosPptAll,
  type GraficosConsolidadoPreflight,
} from "../../api/client";
import { ContenedorEntregable } from "../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../components/entregables/useGeneracion";
import { useSession } from "../../lib/SessionContext";
import { processingBaseScopePresentation } from "../procesamiento/baseScopeModel";
import { flushGraficosConfigIfHydrated } from "./configSnapshot";
import {
  multibaseReportMenuPresentation,
  sharedReportPendingRequirements,
  type SharedReportPreflightStatus,
} from "./multibaseReportMenuModel";
import { formatoConteo } from "../../lib/formatoNumero";
import "./multibaseReportMenu.css";

type ExportResult = {
  ok: true;
  file_id: string;
  filename?: string;
  size: number;
  n_slides: number;
};

type ExportAllResult = {
  ok: true;
  file_id: string;
  filename?: string;
  size: number;
  n_bases: number;
  bases: Array<{ nombre: string; filename: string; n_slides: number }>;
  /** Arreglos y advertencias del motor, ya ordenados y con la base de cada lámina (`.graficos_avisos_job`). Ausente
   *  en backends viejos. */
  avisos?: string[];
};

/**
 * El paquete por bases usa la config GUARDADA de cada base (`apiGraficosPptAll`), así que primero se guarda lo que el
 * editor tenga pendiente. El flush respeta el alcance hidratado (A7-1 H1): con el informe compartido abierto guarda el
 * borrador compartido y no toca la config de ninguna base. Si el guardado falla, el paquete no se lanza.
 */
export async function iniciarPaqueteBases(deps: {
  flush: () => Promise<boolean>;
  pptAll: () => Promise<{ job_id: string }>;
}): Promise<string> {
  await deps.flush();
  const result = await deps.pptAll();
  return result.job_id;
}

export function avisosDelPaquete(result: ExportResult | ExportAllResult): string[] {
  const avisos = "avisos" in result && Array.isArray(result.avisos) ? result.avisos : [];
  return avisos.filter((aviso): aviso is string => typeof aviso === "string" && aviso.trim() !== "");
}

export function AvisosPaqueteBases({ avisos }: { avisos: readonly string[] }) {
  if (!avisos.length) return null;
  return (
    <div className="pulso-multibase-reports-preflight" data-tone="blocked" role="status">
      <span aria-hidden="true"><AlertTriangle size={14} /></span>
      <div>
        <strong>{avisos.length === 1 ? "1 aviso del paquete" : `${formatoConteo(avisos.length)} avisos del paquete`}</strong>
        <ul className="pulso-multibase-reports-blockers">
          {avisos.map((aviso, indice) => <li key={`${indice}-${aviso}`}>{aviso}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function MultibaseReportMenu() {
  const navigate = useNavigate();
  const { state, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<SharedReportPreflightStatus>("idle");
  const [preflight, setPreflight] = useState<GraficosConsolidadoPreflight | null>(null);
  const [error, setError] = useState("");
  const [allBases, setAllBases] = useState<{ avisos: string[] } | null>(null);
  const paquete = useGeneracion({ titulo: "Archivos por base", modulo: "Procesamiento", formato: "zip", articulo: "los" });
  const rootRef = useRef<HTMLDivElement>(null);
  const preflightRequestRef = useRef(0);
  const visible = processingBaseScopePresentation(
    state?.estudio_processing_mode,
    state?.n_bases,
  ).showSharedReports;
  const busy = paquete.estado.fase === "en_curso";
  const presentation = multibaseReportMenuPresentation(preflightStatus, preflight, busy);
  const pendingRequirements = sharedReportPendingRequirements(preflight);

  const loadPreflight = useCallback(async () => {
    const requestId = preflightRequestRef.current + 1;
    preflightRequestRef.current = requestId;
    setPreflightStatus("loading");
    try {
      const result = await apiGraficosConsolidadoPreflight();
      if (preflightRequestRef.current !== requestId) return;
      setPreflight(result);
      setPreflightStatus(result.ready ? "ready" : "blocked");
    } catch (cause) {
      if (preflightRequestRef.current !== requestId) return;
      setPreflight(null);
      setPreflightStatus("error");
      setError(cause instanceof Error ? cause.message : "No se pudo comprobar el informe compartido.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && visible) void loadPreflight();
  }, [loadPreflight, open, visible]);

  const cerrarPaquete = paquete.cerrar;
  useEffect(() => {
    setAllBases(null);
    setError("");
    cerrarPaquete();
    setPreflight(null);
    setPreflightStatus("idle");
    preflightRequestRef.current += 1;
  }, [state?.session_id, cerrarPaquete]);

  if (!visible) return null;

  function configureConsolidated() {
    if (presentation.sharedConfigureDisabled) return;
    setOpen(false);
    navigate("/graficos?scope=consolidado");
  }

  async function startAllBases() {
    if (presentation.packageDisabled || busy) return;
    setOpen(false);
    setAllBases(null);
    // Guardar lo pendiente y lanzar el job van dentro de la generación: si el guardado falla, el contenedor lo dice.
    const r = await paquete.ejecutar(async () => ({
      job_id: await iniciarPaqueteBases({ flush: flushGraficosConfigIfHydrated, pptAll: apiGraficosPptAll }),
    }));
    if (!r.ok) return;
    const result = r.datos as ExportResult | ExportAllResult;
    setAllBases({ avisos: avisosDelPaquete(result) });
    void refresh();
  }

  return (
    <div className={`pulso-multibase-reports${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="pulso-multibase-reports-trigger"
        onClick={() => setOpen((current) => !current)}
        // Mientras arma el paquete, el disparador solo se deshabilita: conserva ícono y rótulo.
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Entregables del conjunto de bases"
        title="Entregables que reúnen las bases independientes"
      >
        <LayoutGrid size={14} aria-hidden="true" />
        <span>Conjunto</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="pulso-multibase-reports-popover" role="dialog" aria-label="Reportes del conjunto de bases">
          <div className="pulso-multibase-reports-head">
            <span aria-hidden="true"><LayoutGrid size={15} /></span>
            <div>
              <strong>Reportes del conjunto</strong>
              <small>{state?.n_bases ?? 0} bases independientes</small>
            </div>
          </div>

          <div className="pulso-multibase-reports-preflight" data-tone={presentation.tone} role="status">
            <span aria-hidden="true">
              {presentation.tone === "ready" ? <CheckCircle2 size={14} /> : presentation.tone === "blocked" ? <AlertTriangle size={14} /> : <Loader2 size={14} className="pulso-spin" />}
            </span>
            <div>
              <strong>{presentation.tone === "ready" ? "Listo para componer" : presentation.tone === "blocked" ? "Revisión requerida" : "Comprobando informe"}</strong>
              <small>{presentation.detail}</small>
            </div>
          </div>

          {preflightStatus === "blocked" && pendingRequirements.length ? (
            <ul className="pulso-multibase-reports-blockers is-detailed">
              {pendingRequirements.map((requirement) => (
                <li key={requirement.base}>
                  <strong>{requirement.actor}</strong>
                  <span>{requirement.detail}</span>
                </li>
              ))}
            </ul>
          ) : preflightStatus === "blocked" && preflight?.blockers.length ? (
            <ul className="pulso-multibase-reports-blockers">
              {preflight.blockers.slice(0, 3).map((blocker) => (
                <li key={`${blocker.code}-${blocker.message}`}>{blocker.message}</li>
              ))}
            </ul>
          ) : null}

          <button type="button" className="pulso-multibase-report-option" onClick={configureConsolidated} disabled={presentation.sharedConfigureDisabled}>
            <span aria-hidden="true"><LayoutGrid size={15} /></span>
            <span>
              <strong>Configurar informe compartido</strong>
              <small>Edita láminas con el catálogo de todas las fuentes</small>
            </span>
          </button>
          <button type="button" className="pulso-multibase-report-option" onClick={() => void startAllBases()} disabled={presentation.packageDisabled}>
            <span aria-hidden="true"><Archive size={15} /></span>
            <span>
              <strong>Archivos por base</strong>
              <small>ZIP con un PPTX independiente por base</small>
            </span>
          </button>

          {error && <div className="pulso-multibase-reports-error" role="alert">{error}</div>}
        </div>
      )}

      <ContenedorEntregable
        estado={paquete.estado}
        forma="anclada"
        onCerrar={paquete.cerrar}
        pie={paquete.estado.fase === "lista" && allBases ? <AvisosPaqueteBases avisos={allBases.avisos} /> : undefined}
      />
    </div>
  );
}
