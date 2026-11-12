// "Preguntas que la usan" ("La usan N preguntas" en el prototipo, Analítica › Categorías): las preguntas que
// comparten la lista elegida y heredan su orden.

import type { VariableInstrumento } from "../../../api/analitica";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { textoPlano } from "../../../lib/textoPlano";

export function PreguntasDeLaLista({ preguntas }: { preguntas: readonly VariableInstrumento[] }) {
  return (
    <PanelDeMesa zona="preguntas" titulo="Preguntas que la usan" conteo={preguntas.length}>
      {preguntas.length > 0 ? (
        <ul
          className="categorias-preguntas"
          aria-label="Preguntas que usan la lista"
          data-qa-geometry-group="analitica/categorias-preguntas"
          data-qa-geometry-contract="intrinsic"
        >
          {preguntas.map((v) => (
            <li key={v.name}>
              <code>{v.name}</code>
              <span>{textoPlano(v.label ?? "") || "Sin etiqueta"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="categorias-nota categorias-nota--cuerpo">Elige una lista para ver qué preguntas la usan.</p>
      )}
    </PanelDeMesa>
  );
}
