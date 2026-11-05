// «Nombre corto de la pregunta» en la tarjeta (antes «Etiqueta corta»; H6: «Etiqueta corta» era también el antetítulo del
// bloque de hallazgos): el de la pregunta del gráfico y, en las multiapiladas de una barra por pregunta, una por
// pregunta (U9 del checklist de mandos del mazo). Todas viven en `overrides.etiquetas_vars[ref]` (leerEtiquetaCorta y
// conEtiquetaCorta; el modelo de cuáles van en etiquetasPorPregunta.ts). El campo guarda el texto sin espacios en los
// bordes, así que se escribe sobre un borrador: sin él, el espacio entre dos palabras se perdía al teclearlo.

import { useId, useState } from "react";
import { conEtiquetaCorta, leerEtiquetaCorta } from "./argsDatosGrafico";
import { preguntasConEtiqueta, tituloDeGrupo } from "./etiquetasPorPregunta";
import { parseVarRef, useVariables } from "../useVariables";

type Args = Readonly<Record<string, unknown>>;
type Props = { args: Args; onCambio: (overrides: Record<string, unknown>) => void };

const AYUDA = "Nombre breve de la pregunta en la lámina y el Word. Vacío, usa el del instrumento.";

/** La etiqueta corta de la única pregunta del gráfico. */
export function EtiquetaCortaPregunta({ args, variable, onCambio }: Props & { variable: string }) {
  const id = useId();
  return (
    <div className="pulso-f6-dato is-apilado">
      <label className="pulso-f6-dato-rotulo" htmlFor={id}>Nombre corto de la pregunta</label>
      <CampoConBorrador id={id} describe={`${id}-ayuda`} valor={leerEtiquetaCorta(args, variable)}
        onCambio={(t) => onCambio(conEtiquetaCorta(args, variable, t))} />
      <span id={`${id}-ayuda`} className="pulso-f6-dato-ayuda">{AYUDA}</span>
    </div>
  );
}

/** Una fila por pregunta de la multiapilada: su enunciado y, al lado, su etiqueta corta. */
export function EtiquetasCortasPreguntas({ args, onCambio }: Props) {
  const id = useId();
  const { variables } = useVariables();
  const refs = preguntasConEtiqueta(args);
  if (!refs.length) return null;
  const enunciado = (ref: string) => {
    const r = parseVarRef(ref);
    const v = variables.find((x) => x.name === r.name && (!r.source || x.source === r.source));
    return v?.label?.trim() || r.name;
  };
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="etiquetas-por-pregunta">
      <span className="pulso-f6-dato-rotulo" id={id}>Nombre corto de cada pregunta</span>
      <ul className="pulso-f6-etiquetas-preguntas" aria-labelledby={id}
        data-qa-geometry-group="graficos/f6-etiquetas-preguntas" data-qa-geometry-contract="intrinsic">
        {refs.map((ref, i) => {
          const texto = enunciado(ref);
          const campo = `${id}-p${i}`;
          return (
            <li key={ref} className="pulso-f6-etiqueta-pregunta">
              <label htmlFor={campo} className="pulso-f6-etiqueta-pregunta-texto" title={parseVarRef(ref).name}>{texto}</label>
              <CampoConBorrador id={campo} valor={leerEtiquetaCorta(args, ref)} placeholder={tituloDeGrupo(args, ref) || "Como en el instrumento"}
                onCambio={(t) => onCambio(conEtiquetaCorta(args, ref, t))} />
            </li>
          );
        })}
      </ul>
      <span className="pulso-f6-dato-ayuda">Vacía, la barra lleva el enunciado del instrumento.</span>
    </div>
  );
}

function CampoConBorrador({ id, valor, placeholder, describe, onCambio }: {
  id: string; valor: string; placeholder?: string; describe?: string; onCambio: (t: string) => void;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  // Mientras se escribe manda el borrador; si el plan cambió por otro lado (deshacer), lo guardado.
  const visible = borrador !== null && borrador.trim() === valor ? borrador : valor;
  return (
    <input id={id} className="pulso-f6-input" value={visible} placeholder={placeholder} aria-describedby={describe}
      onChange={(e) => { setBorrador(e.target.value); onCambio(e.target.value); }}
      onBlur={() => setBorrador(null)} />
  );
}
