// Ficha de una pregunta con versiones al azar (checklist elección por pares C13, 2026-11-07). Su enunciado es el
// texto de la versión sorteada (`${…_texto}`): aquí se ven las versiones como texto, con su peso, y se editan en la
// pestaña Experimentos, no escribiendo la referencia.

import { renderMarkdownInline } from "../../helpers/markdown";
import { nombresVersiones, type DisenoVersiones } from "../../conjoint/modeloVersiones";
import { BloqueFicha } from "./piezasFicha";

export function VersionesFicha({ diseno, onEditarDiseno }: { diseno: DisenoVersiones; onEditarDiseno: () => void }) {
  const conPesos = diseno.versiones.every((v) => v.peso != null);
  return (
    <BloqueFicha
      titulo={`Pregunta en ${diseno.versiones.length} versiones`}
      accion={
        <button type="button" className="xfh-boton" onClick={onEditarDiseno}>
          Editar en Experimentos
        </button>
      }
    >
      <ol className="xfh-versiones">
        {diseno.versiones.map((v, i) => (
          <li key={i}>
            <span className="xfh-versiones__n">Versión {i + 1}</span>
            <span className="xfh-versiones__texto" dangerouslySetInnerHTML={{ __html: renderMarkdownInline(v.texto) }} />
            {conPesos ? <span className="xfh-versiones__peso">{Math.round((v.peso ?? 0) * 100)}%</span> : null}
          </li>
        ))}
      </ol>
      <p className="xfh-tabla-par__pie">
        <span>
          A cada encuestado le toca una. La versión queda en <code>{nombresVersiones(diseno.prefijo).version}</code>.
        </span>
      </p>
    </BloqueFicha>
  );
}
