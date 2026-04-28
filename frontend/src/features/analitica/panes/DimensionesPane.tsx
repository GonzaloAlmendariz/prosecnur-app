import { Edit3, Layers, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  apiAnaliticaDimensionesBuild,
  apiAnaliticaDimensionesPreview,
  apiAnaliticaDimensionesStatus,
  apiProjectSave,
  apiProjectStatus,
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
    <Panel
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Layers size={16} /> Dimensiones e índices
        </span>
      }
      hint="Recodifica preguntas evaluativas a una escala 0-100, agrúpalas en bloques temáticos y combínalas en índices compuestos. El resultado alimenta Cruces (modo dimensiones), Gráficos PPT/Word y el módulo Dashboard."
    >
      {efectivo === "wizard" ? (
        <DimensionesWizard onComplete={onWizardComplete} />
      ) : (
        <ResumenPostBuild onEditar={abrirWizardDesdeConfig} />
      )}
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
        setHasBuilt(r.built);
        if (r.built) {
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
      // Disparar guardado del .pulso en silencio para persistir el resultado
      // sin esperar al autosave (5 min). Solo si hay un proyecto activo.
      try {
        const status = await apiProjectStatus();
        if (status.has_project) await apiProjectSave(null);
      } catch {
        /* no-bloqueante */
      }
    } catch (e) {
      setStatusErr((e as Error).message);
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  }

  if (statusErr) {
    return <ErrorBlock label="No se pudo leer el estado de dimensiones" detail={statusErr} />;
  }
  if (hasBuilt === null) return <LoadingBlock label="Cargando estado…" />;

  if (!hasBuilt) {
    // Edge case: state.analitica_dim_ok true pero el backend dice no built.
    // Caemos al wizard.
    return (
      <Alert kind="warn">
        El estado del proyecto indicaba dimensiones generadas, pero no encontramos
        la base. Vuelve al asistente para reconstruirlas.
      </Alert>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Alert kind="info">
        Dimensiones activas. Cruces, Gráficos y Dashboard ya pueden consumir{" "}
        <code>idx_*</code> y <code>sub_*</code>. Si cambiaste la base río arriba,
        regenera para refrescar; si quieres reorganizar la estructura, edítala.
        <br />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
          💾 Esta configuración viaja con tu <code>.pulso</code> — al reabrir el
          proyecto, las dimensiones estarán listas sin re-importar nada.
        </span>
      </Alert>

      <div
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          border: "1px solid var(--pulso-border)",
          background: "var(--pulso-surface)",
          overflowX: "auto",
        }}
      >
        <DiagramaArbol
          listas={dim.listas_objetivo}
          bloques={dim.subindices}
          indices={dim.indices}
        />
      </div>

      {cobertura && cobertura.length > 0 && (
        <section>
          <h4
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: "var(--pulso-text-soft)",
            }}
          >
            Cobertura por columna
          </h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
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

      <footer
        style={{
          display: "flex",
          gap: 10,
          paddingTop: 12,
          borderTop: "1px solid var(--pulso-border)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="pulso-primary"
          onClick={onEditar}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Edit3 size={13} /> Editar estructura
        </button>
        <button
          type="button"
          onClick={regenerar}
          disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={13} /> {busy ? "Regenerando…" : "Regenerar"}
        </button>
        {busy && <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{busyMsg}</span>}
      </footer>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderBottom: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface-2, #f4f5f9)",
        fontWeight: 600,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.3,
        color: "var(--pulso-text-soft)",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "6px 10px",
        borderBottom: "1px solid var(--pulso-border-soft, #eef0f5)",
        fontFamily: mono ? "ui-monospace, monospace" : undefined,
      }}
    >
      {children}
    </td>
  );
}
