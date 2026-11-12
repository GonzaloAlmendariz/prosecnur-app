import { ArrowRight } from "../../../../vendor/lucide-react";
import type { ChoiceCodeMap } from "../../../../api/client";

const PARES_VISIBLES = 4;

/**
 * Las preguntas cuyas respuestas trajeron códigos que no son los de su lista
 * en el formulario, con el emparejamiento que propone la carga ("H" pasa a
 * "1 Hombre"). Se confirma en el diálogo de mapeo, desde la columna derecha.
 */
export function CodigosPorConfirmar({ mapas }: { mapas: readonly ChoiceCodeMap[] }) {
  if (mapas.length === 0) {
    return <p className="pulso-revision-nada pulso-revision-relleno">Los códigos de las respuestas coinciden con las listas del formulario.</p>;
  }
  return (
    <ul
      className="pulso-revision-mapas"
      aria-label="Preguntas con códigos por confirmar"
      data-qa-geometry-group="carga/revision-mapas"
      data-qa-geometry-contract="intrinsic"
    >
      {mapas.map((mapa) => {
        const visibles = mapa.mappings.slice(0, PARES_VISIBLES);
        const resto = mapa.mappings.length - visibles.length;
        return (
          <li key={mapa.variable} className="pulso-revision-mapa">
            <div className="pulso-revision-mapa-pregunta">
              <b>{mapa.label || mapa.variable}</b>
              <code>{mapa.variable}</code>
            </div>
            <ul className="pulso-revision-pares" aria-label={`Códigos de ${mapa.label || mapa.variable}`}>
              {visibles.map((par) => (
                <li key={`${par.source_column}:${par.source_code}`}>
                  <code>{par.source_code}</code>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span className="pulso-sr-only">pasa a</span>
                  <code>{par.xls_code}</code>
                  <span>{par.xls_label}</span>
                </li>
              ))}
              {resto > 0 ? <li className="pulso-revision-pares-resto">{resto === 1 ? "1 código más" : `${resto} códigos más`}</li> : null}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
