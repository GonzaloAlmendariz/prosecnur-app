import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ProgressStepper } from "./ProgressStepper";
import { Step1_Plantilla } from "./steps/Step1_Plantilla";
import { Step2_ListasEvaluativas } from "./steps/Step2_ListasEvaluativas";
import { Step3_Bloques } from "./steps/Step3_Bloques";
import { Step4_Indices } from "./steps/Step4_Indices";
import { Step5_Confirmar } from "./steps/Step5_Confirmar";
import { useDimensionesWizardStore, WizardStep } from "./store";

// Contenedor del wizard. Mantiene "furthestVisited" para que el stepper
// permita saltar a pasos previos pero no a futuros sin antes pasar por
// next(). Inyecta el callback `onSuccess` desde DimensionesPane para que
// al completar el step 5 cambie a la vista de resumen.

export function DimensionesWizard({ onComplete }: { onComplete: () => void }) {
  const step = useDimensionesWizardStore((s) => s.step);
  const goTo = useDimensionesWizardStore((s) => s.goTo);
  const next = useDimensionesWizardStore((s) => s.next);
  const back = useDimensionesWizardStore((s) => s.back);
  const draft = useDimensionesWizardStore((s) => s.draft);

  const [furthestVisited, setFurthestVisited] = useState<WizardStep>(step);
  useEffect(() => {
    setFurthestVisited((cur) => (step > cur ? step : cur));
  }, [step]);

  // Validaciones por paso para deshabilitar "Continuar" cuando algo
  // crítico falta. No bloqueamos retroceso.
  const puedeAvanzar = (() => {
    if (step === 2) return draft.listas_objetivo.length > 0;
    if (step === 3) return draft.subindices.some((b) => b.vars.length > 0);
    return true;
  })();

  const hint = (() => {
    if (step === 2 && !puedeAvanzar) return "Marca al menos una lista evaluativa.";
    if (step === 3 && !puedeAvanzar) return "Asigna al menos una variable a un bloque.";
    return "";
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ProgressStepper current={step} furthestVisited={furthestVisited} onJump={goTo} />

      <div
        key={step}
        style={{
          // Cross-fade ligero entre pasos para no perder el contexto.
          animation: "pulso-lens-fade-in-kf var(--anim-dur-med) var(--anim-ease-smooth)",
        }}
      >
        {step === 1 && (
          <Step1_Plantilla
            onAdvance={(toStep) => {
              setFurthestVisited((cur) => (toStep > cur ? toStep : cur));
              goTo(toStep);
            }}
          />
        )}
        {step === 2 && <Step2_ListasEvaluativas />}
        {step === 3 && <Step3_Bloques />}
        {step === 4 && <Step4_Indices />}
        {step === 5 && <Step5_Confirmar onSuccess={onComplete} />}
      </div>

      {/* Footer con back/next solo en steps 2-4. Step 1 elige por sí mismo
          via cards; step 5 tiene su propio botón "Generar". */}
      {step >= 2 && step <= 4 && (
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--pulso-border)",
          }}
        >
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={13} /> Atrás
          </button>
          <span style={{ flex: 1, fontSize: 11, color: "var(--pulso-text-soft)" }}>
            {hint}
          </span>
          <button
            type="button"
            className="pulso-primary"
            disabled={!puedeAvanzar}
            onClick={next}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Continuar <ArrowRight size={13} />
          </button>
        </footer>
      )}
    </div>
  );
}
