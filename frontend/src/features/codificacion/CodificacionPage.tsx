import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { PreguntasLanding } from "./PreguntasLanding";
import { CodificarWizard } from "./CodificarWizard";
import { AdaptarPane } from "./AdaptarPane";

type Step = "organizar" | "codificar" | "adaptar";

export default function CodificacionPage() {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const prereqOk = !!state?.xlsform && !!state?.data;

  // Step persistido en query string (?step=codificar | adaptar).
  const rawStep = new URLSearchParams(location.search).get("step");
  const step: Step =
    rawStep === "codificar" ? "codificar" :
    rawStep === "adaptar" ? "adaptar" :
    "organizar";

  function goStep(next: Step) {
    const sp = new URLSearchParams(location.search);
    if (next === "organizar") sp.delete("step");
    else sp.set("step", next);
    navigate({ pathname: "/codificacion", search: sp.toString() ? `?${sp}` : "" });
  }

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  return (
    <section>
      <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
      <p className="pulso-page-lead">
        {step === "organizar"
          ? "Organiza todas las preguntas: empareja SO/SM con sus 'Otros, especifique' y marca las que quieres codificar."
          : step === "codificar"
          ? "Codifica una por una las preguntas marcadas. Agrupa respuestas similares y asigna un código a cada grupo."
          : "Revisa lo que se va a adaptar. Cuando estés listo, lanza la adaptación y descarga los archivos."}
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

      {prereqOk && step === "organizar" && <PreguntasLanding />}

      {prereqOk && step === "codificar" && (
        <CodificarWizard onBackToOrganizar={() => goStep("organizar")} />
      )}

      {prereqOk && step === "adaptar" && (
        <AdaptarPane onBackToCodificar={() => goStep("codificar")} />
      )}
    </section>
  );
}

function Stepper({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const order: Step[] = ["organizar", "codificar", "adaptar"];
  const currentIdx = order.indexOf(step);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StepChip n={1} label="Organizar" active={step === "organizar"} done={currentIdx > 0} onClick={() => onChange("organizar")} />
      <Line done={currentIdx > 0} />
      <StepChip n={2} label="Codificar" active={step === "codificar"} done={currentIdx > 1} onClick={() => onChange("codificar")} />
      <Line done={currentIdx > 1} />
      <StepChip n={3} label="Adaptar" active={step === "adaptar"} onClick={() => onChange("adaptar")} />
    </div>
  );
}

function Line({ done }: { done: boolean }) {
  return <div style={{ flex: "0 0 40px", height: 2, background: done ? "var(--pulso-primary)" : "var(--pulso-border)" }} />;
}

function StepChip({ n, label, active, onClick, done }: { n: number; label: string; active: boolean; onClick: () => void; done?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 14px", borderRadius: 999,
        border: `1px solid ${active || done ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
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
