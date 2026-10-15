// La lista de preguntas de un gráfico (`vars`) en la pestaña Gráfico (catálogo del recetario, I1).
//
// Antes no tenía control: el inspector de las barras divergentes decía «Elige una pregunta…» con seis preguntas en la
// lámina, y la serie temporal y la tabla no decían qué preguntas tenían. Una lista se edita aquí (cambiar, quitar,
// agregar); unos temas con sus preguntas por base se muestran. P21: la serie temporal, el radar entre públicos y la
// brecha entre dos bases ya no pasan por aquí: se arman con temas por público (temasEquivalentes/).

import { Plus, X } from "../../../vendor/lucide-react";
import VariablePicker from "../VariablePicker";
import { parseVarRef, useVariables } from "../useVariables";

type Props = { valor: unknown; onCambio: (v: unknown) => void; describe?: string };

export function ListaPreguntas({ valor, onCambio, describe }: Props) {
  const { variables } = useVariables();
  const nombre = (ref: string) => {
    const r = parseVarRef(ref);
    const v = variables.find((x) => x.name === r.name && (!r.source || x.source === r.source));
    const rotulo = v?.label?.trim() || r.name;
    return r.source ? `${rotulo}, ${r.source}` : rotulo;
  };

  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    const temas = Object.entries(valor as Record<string, unknown>);
    return (
      <ul className="pulso-f6-preguntas is-temas" aria-describedby={describe}>
        {temas.map(([tema, refs]) => (
          <li key={tema}>
            <span className="pulso-f6-preguntas-tema">{tema}</span>
            <span className="pulso-f6-preguntas-refs">{(Array.isArray(refs) ? refs : [refs]).map((r) => nombre(String(r))).join(", ")}</span>
          </li>
        ))}
      </ul>
    );
  }

  const lista = (Array.isArray(valor) ? valor : []).map(String).filter(Boolean);
  const reemplazar = (i: number, ref: string | null) => {
    const siguiente = [...lista];
    if (ref) siguiente[i] = ref;
    else siguiente.splice(i, 1);
    onCambio(siguiente);
  };
  return (
    <div className="pulso-f6-preguntas" aria-describedby={describe}>
      {lista.map((ref, i) => (
        <div key={`${ref}-${i}`} className="pulso-f6-preguntas-fila">
          <VariablePicker value={ref} onChange={(v) => reemplazar(i, v)} placeholder="Elige una pregunta…" />
          <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Quitar ${nombre(ref)}`} onClick={() => reemplazar(i, null)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="pulso-f6-preguntas-fila is-nueva">
        <Plus size={14} aria-hidden="true" />
        <VariablePicker value={null} onChange={(v) => v && onCambio([...lista, v])} placeholder="Agregar pregunta…" />
      </div>
    </div>
  );
}
