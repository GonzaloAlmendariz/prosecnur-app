import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import {
  apiCodifAplicar,
  AplicarResult,
  downloadUrl,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PreguntasLanding } from "./PreguntasLanding";
import { CodificarWizard } from "./CodificarWizard";

type Step = "organizar" | "codificar";

export default function CodificacionPage() {
  const { state, refresh } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string>("");
  const [adaptados, setAdaptados] = useState<{ data: string; inst: string } | null>(null);
  const [aplicarJobId, setAplicarJobId] = useState<string | null>(null);

  const prereqOk = !!state?.xlsform && !!state?.data;

  // Step state persistido en query string (?step=codificar).
  const step: Step = new URLSearchParams(location.search).get("step") === "codificar" ? "codificar" : "organizar";
  function goStep(next: Step) {
    const sp = new URLSearchParams(location.search);
    if (next === "codificar") sp.set("step", "codificar");
    else sp.delete("step");
    navigate({ pathname: "/codificacion", search: sp.toString() ? `?${sp}` : "" });
  }

  async function onAplicar() {
    setError("");
    setAdaptados(null);
    try {
      const out = await apiCodifAplicar();
      setAplicarJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function onAplicarDone(data: AplicarResult) {
    setAdaptados({ data: data.data_adaptada.file_id, inst: data.instrumento_adaptado.file_id });
    setAplicarJobId(null);
    void refresh();
  }
  function onAplicarError(msg: string) { setError(msg); setAplicarJobId(null); }
  function onAplicarCancelled() { setAplicarJobId(null); }

  // Scroll top on step change
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  return (
    <section>
      <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
      <p className="pulso-page-lead">
        {step === "organizar"
          ? "Organiza todas las preguntas: empareja SO/SM con sus 'Otros, especifique' y marca las que quieres codificar."
          : "Codifica una por una las preguntas marcadas. Agrupa respuestas similares y asigna un código a cada grupo."}
      </p>

      {prereqOk && (
        <div style={{ marginBottom: 20 }}>
          <Stepper step={step} onChange={goStep} />
        </div>
      )}

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

      {prereqOk && step === "organizar" && (
        <>
          <PreguntasLanding />
          <div style={{ marginTop: 24, padding: 14, background: "var(--pulso-surface)", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13 }}>
              Cuando termines de emparejar y marcar, pasa a codificar cada pregunta.
            </div>
            <div style={{ flex: 1 }} />
            <button className="pulso-primary" onClick={() => goStep("codificar")}>
              Ir a codificar →
            </button>
          </div>
        </>
      )}

      {prereqOk && step === "codificar" && (
        <CodificarWizard
          onBackToOrganizar={() => goStep("organizar")}
          onApply={onAplicar}
          applyBusy={!!aplicarJobId}
        />
      )}

      {aplicarJobId && (
        <div style={{ marginTop: 12 }}>
          <JobProgress<AplicarResult>
            label="Aplicando codificación"
            jobId={aplicarJobId}
            onDone={onAplicarDone}
            onError={onAplicarError}
            onCancelled={onAplicarCancelled}
          />
        </div>
      )}

      {adaptados && (
        <Panel eyebrow="Resultado" title="Archivos adaptados">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={downloadUrl(adaptados.data)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> data_adaptada.xlsx
            </a>
            <a href={downloadUrl(adaptados.inst)} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={13} /> instrumento_adaptado.xlsx
            </a>
          </div>
        </Panel>
      )}

      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}

function Stepper({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StepChip n={1} label="Organizar" active={step === "organizar"} onClick={() => onChange("organizar")} done={step === "codificar"} />
      <div style={{ flex: "0 0 40px", height: 2, background: step === "codificar" ? "var(--pulso-primary)" : "var(--pulso-border)" }} />
      <StepChip n={2} label="Codificar" active={step === "codificar"} onClick={() => onChange("codificar")} />
    </div>
  );
}

function StepChip({ n, label, active, onClick, done }: { n: number; label: string; active: boolean; onClick: () => void; done?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 14px", borderRadius: 999,
        border: `1px solid ${active ? "var(--pulso-primary)" : done ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: active ? "var(--pulso-primary)" : "white",
        color: active ? "white" : done ? "var(--pulso-primary)" : "var(--pulso-text)",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: "50%",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: active ? "white" : done ? "var(--pulso-primary)" : "var(--pulso-border)",
        color: active ? "var(--pulso-primary)" : done ? "white" : "var(--pulso-text-soft)",
        fontSize: 11, fontWeight: 700,
      }}>
        {n}
      </span>
      {label}
    </button>
  );
}
