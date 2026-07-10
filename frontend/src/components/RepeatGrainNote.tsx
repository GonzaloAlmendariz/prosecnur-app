import { Layers } from "lucide-react";
import { formatRepeatGrain, type RepeatGrain } from "../lib/repeatIdentity";
import "./repeat-identity.css";

// Indicador de grano de una base hija repeat (ADR 0030 Fase 5).
//
// Cuando la base activa es hija de un begin_repeat, su grano es la INSTANCIA
// del roster, no la persona. Este banner en naranja suave lo hace explícito
// (N = instancias · personas) y advierte del clustering, para que el analista
// lea correctamente el denominador de frecuencias y cruces. No cambia ningún
// cálculo: solo etiqueta. Devuelve `null` cuando no hay grano que mostrar, así
// el caller puede montarlo incondicionalmente.

type RepeatGrainNoteProps = {
  grain: RepeatGrain | null | undefined;
  /** Variante inline compacta para barras densas (ContextBar de Analítica). */
  inline?: boolean;
  className?: string;
};

export function RepeatGrainNote({ grain, inline = false, className }: RepeatGrainNoteProps) {
  const display = formatRepeatGrain(grain);
  if (!display) return null;
  return (
    <div
      className={`pulso-repeat-grain${inline ? " is-inline" : ""}${className ? ` ${className}` : ""}`}
      role="note"
      data-repeat-grain="true"
      data-audit-ready="true"
    >
      <span className="pulso-repeat-grain-icon" aria-hidden="true">
        <Layers size={inline ? 14 : 16} />
      </span>
      <div className="pulso-repeat-grain-body">
        <span className="pulso-repeat-grain-headline">{display.headline}</span>
        {!inline && display.caveat && (
          <span className="pulso-repeat-grain-caveat">{display.caveat}</span>
        )}
      </div>
    </div>
  );
}
