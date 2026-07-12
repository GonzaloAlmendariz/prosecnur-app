/**
 * Disclosure didáctico "¿por qué?": la razón de una decisión del método, al
 * alcance pero sin estorbar. Regla del recorrido: ningún número sin su porqué.
 */
import { useState, type ReactNode } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";

export function NotaPorQue({
  pregunta = "¿Por qué así?",
  abierta = false,
  children,
}: {
  pregunta?: string;
  abierta?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(abierta);
  return (
    <div className="rec-porque" data-open={open || undefined}>
      <button type="button" className="rec-porque-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Lightbulb size={13} aria-hidden="true" />
        <span>{pregunta}</span>
        <ChevronRight size={13} className="rec-porque-caret" aria-hidden="true" />
      </button>
      {open && <div className="rec-porque-body">{children}</div>}
    </div>
  );
}
