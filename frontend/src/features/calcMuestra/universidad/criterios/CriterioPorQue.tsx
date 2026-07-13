/**
 * Disclosure "¿Por qué así?" de una tarjeta de la suite de criterios. Pliega la
 * explicación metodológica (incluye/excluye + porqué) que antes vivía en la
 * pestaña didáctica retirada. Presentacional: recibe el rationale ya resuelto
 * por el dominio (`rationaleParaCriterio`). Estilado con tokens cmv2-crit-*.
 */
import { useState } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import type { CriterioRationale } from "../../dominio";

export function CriterioPorQue({ rationale }: { rationale: CriterioRationale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cmv2-crit-porque" data-open={open || undefined}>
      <button
        type="button"
        className="cmv2-crit-porque-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Lightbulb size={13} aria-hidden="true" />
        <span>¿Por qué así?</span>
        <ChevronRight size={13} className="cmv2-crit-porque-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="cmv2-crit-porque-body">
          {(rationale.incluye || rationale.excluye) && (
            <p className="cmv2-crit-porque-regla">
              {rationale.incluye ? (
                <>
                  <strong>Incluye:</strong> {rationale.incluye}.
                </>
              ) : null}
              {rationale.excluye ? (
                <>
                  {" "}
                  <strong>Excluye:</strong> {rationale.excluye}.
                </>
              ) : null}
            </p>
          )}
          <p className="cmv2-crit-porque-nota">{rationale.porQue}</p>
        </div>
      )}
    </div>
  );
}
