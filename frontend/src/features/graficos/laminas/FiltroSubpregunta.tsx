// La tarjeta de «Pregunta filtro y subpregunta» (recetario p192–p194): la pregunta filtro, las respuestas que habilitan la
// subpregunta (botones con las respuestas del filtro, no códigos tecleados) y la subpregunta. Su base es la de quienes
// dieron una de esas respuestas; la lámina lo escribe bajo el título de la subpregunta.

import { useId } from "react";
import VariablePicker from "../VariablePicker";
import { parseVarRef, useVariables } from "../useVariables";

type Props = { args: Record<string, unknown>; onCambio: (patch: Record<string, unknown>) => void };

export function FiltroSubpregunta({ args, onCambio }: Props) {
  const idHab = useId();
  const { variables } = useVariables();
  const filtro = typeof args.var === "string" ? args.var : null;
  const ref = filtro ? parseVarRef(filtro) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  const habilita = new Set((Array.isArray(args.habilita) ? args.habilita : typeof args.habilita === "string" ? args.habilita.split(",") : [])
    .map((x) => String(x).trim()).filter(Boolean));
  const alternar = (r: string) => {
    const siguiente = respuestas.filter((x) => (x === r ? !habilita.has(x) : habilita.has(x)));
    onCambio({ habilita: siguiente.length ? siguiente : null });
  };
  return (
    <>
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo">Pregunta filtro</span>
        <div className="pulso-f6-dato-control">
          <VariablePicker value={filtro} onChange={(v) => onCambio({ var: v ?? null, habilita: null })} placeholder="Elige la pregunta filtro…" />
        </div>
      </div>
      {respuestas.length > 0 && (
        <div className="pulso-f6-dato is-apilado" data-qa="filtro-habilita">
          <span className="pulso-f6-dato-rotulo" id={idHab}>Respuestas que habilitan</span>
          <div className="pulso-f6-destacar" role="group" aria-labelledby={idHab}>
            {respuestas.map((r) => (
              <button key={r} type="button" className="pulso-f6-destacar-opcion is-unica" aria-checked={habilita.has(r)} role="checkbox"
                onClick={() => alternar(r)}>{r}</button>
            ))}
          </div>
          {habilita.size === 0 && <span className="pulso-f6-dato-ayuda" role="note">Elige al menos una: sin ella la subpregunta no tiene base.</span>}
        </div>
      )}
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo">Subpregunta</span>
        <div className="pulso-f6-dato-control">
          <VariablePicker value={typeof args.subpregunta === "string" ? args.subpregunta : null} onChange={(v) => onCambio({ subpregunta: v ?? null })}
            placeholder="Elige la subpregunta…" />
        </div>
      </div>
    </>
  );
}
