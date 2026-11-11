import { ArrowRight, CheckCircle2 } from "../../../vendor/lucide-react";

// =====================================================================
// CTA al final — "Continuar a Validación"
// =====================================================================
export function ContinuarCTA() {
  return (
    <div className="pulso-continue-cta">
      <span aria-hidden="true" className="pulso-continue-cta-icon">
        <CheckCircle2 size={17} />
      </span>
      <div className="pulso-continue-cta-copy">
        <div className="pulso-continue-cta-title">
          Insumos cargados
        </div>
        <div className="pulso-continue-cta-note">
          Ya puedes auditar las respuestas en Validación o pasar directo a Codificación si no necesitas revisar reglas.
        </div>
      </div>
      <a
        href="/validacion"
        className="pulso-continue-cta-link"
      >
        Ir a Validación <ArrowRight size={13} />
      </a>
    </div>
  );
}
