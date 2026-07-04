import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";

export type ProcessingPrereqStep = {
  label: string;
  detail: string;
  Icon: LucideIcon;
};

type ProcessingPrereqGateProps = {
  eyebrow: string;
  title: string;
  copy: string;
  ctaLabel: string;
  note: string;
  steps: ProcessingPrereqStep[];
};

export function ProcessingPrereqGate({
  eyebrow,
  title,
  copy,
  ctaLabel,
  note,
  steps,
}: ProcessingPrereqGateProps) {
  return (
    <section className="pulso-processing-prereq" aria-label={title}>
      <div className="pulso-processing-prereq-main">
        <span className="pulso-processing-prereq-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="pulso-processing-prereq-actions">
          <Link className="pulso-processing-prereq-cta" to="/carga">
            <span>{ctaLabel}</span>
            <ArrowRight size={15} />
          </Link>
          <span className="pulso-processing-prereq-note">
            <CheckCircle2 size={14} />
            {note}
          </span>
        </div>
      </div>

      <div className="pulso-processing-prereq-steps" aria-label="Insumos requeridos">
        {steps.map(({ label, detail, Icon }, index) => (
          <div className="pulso-processing-prereq-step" key={label}>
            <span className="pulso-processing-prereq-step-icon" aria-hidden="true">
              <Icon size={17} />
            </span>
            <span className="pulso-processing-prereq-step-copy">
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
            <span className="pulso-processing-prereq-step-index" aria-hidden="true">
              {index + 1}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
