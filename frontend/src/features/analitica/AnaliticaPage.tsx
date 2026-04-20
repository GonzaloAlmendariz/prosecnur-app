import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { PrepararPane } from "./PrepararPane";
import { DisenarWizard } from "./DisenarWizard";
import { GenerarPane } from "./GenerarPane";
import { useAnaliticaAutosave } from "./useAnaliticaAutosave";

type Step = "preparar" | "disenar" | "generar";

export default function AnaliticaPage() {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  // Hidrata la config desde el backend al montar la página y activa el
  // autosave debounced 2s. Vive en cualquier step porque el store es global.
  useAnaliticaAutosave();

  const prereqOk = !!state?.xlsform && !!state?.data;

  const rawStep = new URLSearchParams(location.search).get("step");
  const step: Step =
    rawStep === "disenar" ? "disenar" :
    rawStep === "generar" ? "generar" :
    "preparar";

  function goStep(next: Step) {
    const sp = new URLSearchParams(location.search);
    if (next === "preparar") sp.delete("step");
    else sp.set("step", next);
    navigate({ pathname: "/analitica", search: sp.toString() ? `?${sp}` : "" });
  }

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  return (
    <section>
      <h1 className="pulso-page-title">Fase 4 — Preparación y reportes analíticos</h1>
      <p className="pulso-page-lead">
        {step === "preparar"
          ? "Prepara los datos y revisa la estructura de secciones del instrumento. Si ya adaptaste en Fase 3, se usará esa versión."
          : step === "disenar"
          ? "Configura cada reporte: variables a incluir, cruces, significancia, modalidades."
          : "Genera los entregables (Excel, SPSS, PDF) con la configuración diseñada y descárgalos."}
      </p>

      {prereqOk && (
        <div style={{ marginBottom: 20 }}>
          <Stepper step={step} onChange={goStep} />
        </div>
      )}

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de preparar.</Alert>
        </div>
      )}

      {prereqOk && step === "preparar" && <PrepararPane />}
      {prereqOk && step === "disenar" && <DisenarWizard />}
      {prereqOk && step === "generar" && <GenerarPane />}
    </section>
  );
}

function Stepper({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const order: Step[] = ["preparar", "disenar", "generar"];
  const currentIdx = order.indexOf(step);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StepChip n={1} label="Preparar" active={step === "preparar"} done={currentIdx > 0} onClick={() => onChange("preparar")} />
      <Line done={currentIdx > 0} />
      <StepChip n={2} label="Diseñar" active={step === "disenar"} done={currentIdx > 1} onClick={() => onChange("disenar")} />
      <Line done={currentIdx > 1} />
      <StepChip n={3} label="Generar" active={step === "generar"} onClick={() => onChange("generar")} />
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
