import { AlertTriangle, Edit3, Layers, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  apiAnaliticaDimensionesBuild,
  apiAnaliticaDimensionesPreview,
  apiAnaliticaDimensionesStatus,
  DimensionesCobertura,
} from "../../../api/client";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { useSession } from "../../../lib/SessionContext";
import { DimensionesWizard } from "../dimensiones/DimensionesWizard";
import { DiagramaArbol } from "../dimensiones/shared/DiagramaArbol";
import { useDimensionesWizardStore } from "../dimensiones/store";
import { useAnaliticaStore } from "../store";

// Pane "Dimensiones" — orquestador delgado.
//
// Decide entre dos vistas:
//   1. Resumen post-build: cuando el proyecto YA tiene dimensiones
//      generadas (state.analitica_dim_ok). Muestra el árbol de la
//      estructura actual + KPIs de cobertura + botones "Editar" /
//      "Regenerar".
//   2. Wizard: cuando no hay dimensiones aún O el usuario hizo click
//      en "Editar". Toma 5 pasos para recolectar la config y construir.
//
// Toda la lógica de edición vive en `dimensiones/`. Este archivo se
// mantiene compacto a propósito.

export function DimensionesPane() {
  const { state } = useSession();
  const dim = useAnaliticaStore((s) => s.config.dimensiones);
  const setWizardDraft = useDimensionesWizardStore((s) => s.setDraft);
  const goToWizardStep = useDimensionesWizardStore((s) => s.goTo);
  const resetWizard = useDimensionesWizardStore((s) => s.reset);

  // Modo del pane: "auto" detecta según session state, "wizard" fuerza
  // wizard (cuando el usuario clickea "Editar estructura"), "resumen"
  // fuerza resumen (post-build).
  const [modo, setModo] = useState<"auto" | "wizard" | "resumen">("auto");

  const builtFlag = !!state?.analitica_dim_ok;
  const efectivo: "wizard" | "resumen" =
    modo === "wizard" ? "wizard" : modo === "resumen" ? "resumen" : builtFlag ? "resumen" : "wizard";
  const listasCount = dim.listas_objetivo.length;
  const bloquesCount = dim.subindices.length;
  const indicesCount = dim.indices.length;

  // Para el modo "wizard" cuando arranca tras "Editar": cargar el draft
  // desde el config persistido en lugar de los defaults vacíos.
  function abrirWizardDesdeConfig() {
    setWizardDraft(dim);
    goToWizardStep(1);
    setModo("wizard");
  }

  // Cuando el wizard termina exitosamente (step 5), volver a resumen.
  function onWizardComplete() {
    resetWizard();
    setModo("resumen");
  }

  return (
    <Panel className="analitica-dimensiones-panel">
      <div className="analitica-report-shell analitica-dimensiones-workbench">
        <div className="analitica-dimensiones-docbar">
          <span className="analitica-dimensiones-docbar-icon" aria-hidden="true">
            <Layers size={16} />
          </span>
          <div className="analitica-dimensiones-docbar-copy">
            <span>Producto de índices</span>
            <strong>Dimensiones e índices</strong>
            <small>Convierte grupos de preguntas en puntajes 0-100 listos para comparar.</small>
          </div>
          <div className="analitica-dimensiones-docbar-stats" aria-label="Estado de dimensiones e índices">
            <span>
              Listas
              <strong>{listasCount}</strong>
            </span>
            <span>
              Bloques
              <strong>{bloquesCount}</strong>
            </span>
            <span>
              Índices
              <strong>{indicesCount}</strong>
            </span>
          </div>
        </div>
      {efectivo === "wizard" ? (
        <DimensionesWizard onComplete={onWizardComplete} />
      ) : (
        <ResumenPostBuild onEditar={abrirWizardDesdeConfig} />
      )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------
// Vista de resumen post-build

function ResumenPostBuild({ onEditar }: { onEditar: () => void }) {
  const dim = useAnaliticaStore((s) => s.config.dimensiones);
  const { refresh } = useSession();

  const [cobertura, setCobertura] = useState<DimensionesCobertura[] | null>(null);
  const [statusErr, setStatusErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [hasBuilt, setHasBuilt] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiAnaliticaDimensionesStatus()
      .then((r) => {
        if (cancelled) return;
        const previewReady = r.built && r.n_filas > 0 && (r.n_idx > 0 || r.n_sub > 0);
        setHasBuilt(previewReady);
        if (previewReady) {
          return apiAnaliticaDimensionesPreview().then((p) => {
            if (!cancelled) setCobertura(p.preview.cobertura);
          });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setStatusErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function regenerar() {
    setBusy(true);
    setBusyMsg("Regenerando dimensiones…");
    setStatusErr("");
    try {
      await apiAnaliticaDimensionesBuild();
      await refresh();
      const p = await apiAnaliticaDimensionesPreview();
      setCobertura(p.preview.cobertura);
      window.dispatchEvent(new Event("pulso:project-status-changed"));
    } catch (e) {
      setStatusErr((e as Error).message);
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  }

  const noDimensiones = statusErr.includes("E_NO_DIM");

  if (statusErr && !noDimensiones) {
    return <ErrorBlock label="No se pudo leer el estado de dimensiones" detail={statusErr} />;
  }

  if (hasBuilt === null && !noDimensiones) return <LoadingBlock label="Cargando estado…" />;

  if (hasBuilt === false || noDimensiones) {
    // Edge case: state.analitica_dim_ok true pero el backend dice no built.
    // Lo tratamos como estado recuperable para no bloquear al analista.
    return (
      <div className="analitica-dimensiones-empty">
        <span className="analitica-dimensiones-empty-icon" aria-hidden="true">
          <AlertTriangle size={16} />
        </span>
        <div className="analitica-dimensiones-empty-copy">
          <strong>Aún no hay puntajes construidos</strong>
          <span>
            Abre el asistente para elegir preguntas, agruparlas en bloques y generar los puntajes que luego usarán Cruces, Gráficos y Dashboard.
          </span>
        </div>
        <button type="button" className="pulso-primary analitica-dimensiones-action" onClick={onEditar}>
          <Edit3 size={13} /> Abrir asistente
        </button>
      </div>
    );
  }

  return (
    <div className="analitica-dimensiones-summary">
      <Alert kind="info">
        Dimensiones activas: Cruces, Gráficos y Dashboard ya pueden usar estos puntajes. Regenera si cambió la base; edita la estructura para reorganizar preguntas.
        <br />
        <span className="analitica-dimensiones-persistence-note">
          La configuración viaja con tu <code>.pulso</code>; al reabrir, los puntajes están listos.
        </span>
      </Alert>

      <div className="analitica-dimensiones-tree">
        <DiagramaArbol
          listas={dim.listas_objetivo}
          bloques={dim.subindices}
          indices={dim.indices}
        />
      </div>

      {cobertura && cobertura.length > 0 && (
        <section className="analitica-dimensiones-coverage">
          <h4>
            Cobertura de puntajes
          </h4>
          <div className="analitica-dimensiones-table-scroll">
            <table className="analitica-dimensiones-table">
              <thead>
                <tr>
                  <Th>Columna</Th>
                  <Th>n válidos</Th>
                  <Th>% válidos</Th>
                  <Th>Media</Th>
                  <Th>SD</Th>
                </tr>
              </thead>
              <tbody>
                {cobertura.map((c) => (
                  <tr key={c.var}>
                    <Td mono>{c.var}</Td>
                    <Td>
                      {c.n_validos}/{c.n}
                    </Td>
                    <Td>{c.pct_validos}%</Td>
                    <Td>{c.media ?? "—"}</Td>
                    <Td>{c.sd ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="analitica-dimensiones-footer">
        <button
          type="button"
          className="pulso-primary"
          onClick={onEditar}
        >
          <Edit3 size={13} /> Editar estructura
        </button>
        <button
          type="button"
          className="pulso-secondary"
          onClick={regenerar}
          disabled={busy}
        >
          <RefreshCw size={13} /> {busy ? "Regenerando…" : "Regenerar"}
        </button>
        {busy && <span className="analitica-dimensiones-busy">{busyMsg}</span>}
      </footer>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th>
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={mono ? "is-mono" : undefined}>
      {children}
    </td>
  );
}
